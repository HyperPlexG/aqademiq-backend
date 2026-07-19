// §4.6 — offline sync delta + batched mutation flush. Port of src/features/sync/sync.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { ymd } from '../../_shared/occurs-on.ts';
import { tasksService } from './tasks.service.ts';
import { subjectsService } from './subjects.service.ts';
import { moodService } from './mood.service.ts';
import { tagsService } from './tags.service.ts';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 14;

export const MUTATION_TYPES = [
  'task.create',
  'task.patch',
  'task.toggle',
  'task.delete',
  'task.move',
  'mood.log',
  'mood.reflect',
  'tag.create',
  'tag.delete',
  'subject.create',
  'subject.patch',
  'subject.delete',
] as const;

export type MutationType = (typeof MUTATION_TYPES)[number];

/** One queued offline mutation. `op_id` is a client-generated idempotency id
 *  echoed back in the result so the client can reconcile its outbox. */
export interface SyncMutationDto {
  op_id: string;
  type: MutationType;
  payload?: Record<string, unknown>;
}

/** §4.6 — flush a batch of offline mutations in order. */
export interface SyncMutationsDto {
  mutations: SyncMutationDto[];
}

function ymdDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function dbNowMs(): Promise<number> {
  const rows = await prismaBase().$queryRaw<Array<{ now: Date }>>`SELECT now() as now`;
  return rows[0].now.getTime();
}

export const syncService = {
  async cursor() {
    return { cursor: await dbNowMs() };
  },

  async changes(since?: string, from?: string, to?: string) {
    const sinceDate = new Date(since && since !== '' ? Number(since) : 0);
    const cursor = await dbNowMs();
    const db = tenantDb();
    const userId = RequestContext.userId;

    // --- courses ---
    const courseRows = await db.course.findMany({
      where: { updated_at: { gt: sinceDate } },
      select: { id: true, is_archived: true },
    });
    const courseUpserts = [];
    const courseTombstones: string[] = [];
    for (const c of courseRows) {
      if (c.is_archived) {
        courseTombstones.push(c.id);
      } else {
        try {
          courseUpserts.push(await subjectsService.get(c.id));
        } catch (e) {
          // Only a genuine not-found is a tombstone. Any other failure must
          // fail the sync request — silently tombstoning here tells every
          // client to DELETE a live subject locally.
          if (e instanceof HttpError && e.status === 404) courseTombstones.push(c.id);
          else throw e;
        }
      }
    }

    // --- academic terms ---
    const activeId = (
      await db.academicTerm.findFirst({ where: { is_current: true }, select: { id: true } })
    )?.id ?? null;
    const termRows = await db.academicTerm.findMany({ where: { updated_at: { gt: sinceDate } } });
    const semesterUpserts = termRows.map((s) => ({
      id: s.id,
      name: s.name,
      start: s.start_date ? ymdDate(s.start_date) : '',
      end: s.end_date ? ymdDate(s.end_date) : '',
      is_active: s.id === activeId,
    }));
    const semesterTombstones: string[] = [];

    // --- tags (using created_at since updated_at doesn't exist) ---
    const tagRows = await db.studyTag.findMany({ where: { created_at: { gt: sinceDate } } });
    const tags = tagRows.map((t) => ({ id: t.id, label: t.name, color: t.color }));

    // --- mood checkins (using created_at) ---
    const moodRows = await db.moodCheckin.findMany({ where: { created_at: { gt: sinceDate } } });
    const mood = moodRows.map((m) => ({
      date: ymd(m.checkin_date),
      mood_index: m.mood_score - 1,
      intention: m.checkin_type === 'morning' ? m.note : null,
      reflection: m.checkin_type === 'evening' ? m.note : null,
    }));

    // --- tasks: check if tasks or history changed ---
    const [tasksChanged, historyChanged] = await Promise.all([
      db.task.count({ where: { updated_at: { gt: sinceDate } } }),
      prismaBase().taskRescheduleHistory.count({
        where: { created_at: { gt: sinceDate }, task: { user_id: userId } },
      }),
    ]);
    let taskDelta: { window: { from: string; to: string }; items: unknown[] } | null = null;
    if (tasksChanged > 0 || historyChanged > 0) {
      const start = from ?? ymd(new Date());
      const end = to ?? ymd(new Date(Date.now() + (DEFAULT_WINDOW_DAYS - 1) * MS_PER_DAY));
      taskDelta = { window: { from: start, to: end }, items: (await tasksService.query({ from: start, to: end })).tasks };
    }

    return {
      cursor,
      changes: {
        subjects: { upserts: courseUpserts, tombstones: courseTombstones },
        semesters: { upserts: semesterUpserts, tombstones: semesterTombstones },
        tags: { upserts: tags },
        mood: { upserts: mood },
        tasks: taskDelta,
      },
    };
  },

  /**
   * POST /sync/mutations — flush a batch of offline mutations in order. Each is
   * applied independently: one failure doesn't abort the batch, and every op's
   * outcome is echoed back keyed by its client `op_id` so the client can prune
   * its outbox. Tenant scoping is enforced by the delegate services.
   */
  async mutations(dto: SyncMutationsDto) {
    const results: Array<{ op_id: string; status: 'applied' | 'failed'; result?: unknown; error?: string }> = [];
    for (const m of dto.mutations) {
      try {
        const result = await applyMutation(m);
        results.push({ op_id: m.op_id, status: 'applied', result });
      } catch (e) {
        results.push({ op_id: m.op_id, status: 'failed', error: e instanceof Error ? e.message : 'Mutation failed' });
      }
    }
    const applied = results.filter((r) => r.status === 'applied').length;
    return { cursor: await dbNowMs(), applied, failed: results.length - applied, results };
  },
};

// deno-lint-ignore no-explicit-any
async function applyMutation(m: SyncMutationDto): Promise<unknown> {
  // deno-lint-ignore no-explicit-any
  const p = (m.payload ?? {}) as Record<string, any>;
  switch (m.type) {
    case 'task.create':
      // deno-lint-ignore no-explicit-any
      return tasksService.create(p as any);
    case 'task.patch': {
      const { id, ...data } = p;
      if (!id) throw new HttpError(400, 'task.patch requires payload.id');
      // deno-lint-ignore no-explicit-any
      return tasksService.patch(id, data as any);
    }
    case 'task.toggle':
      if (!p.id) throw new HttpError(400, 'task.toggle requires payload.id');
      // deno-lint-ignore no-explicit-any
      return typeof p.done === 'boolean' ? tasksService.setDone(p.id, p.done) : tasksService.toggle(p.id, {} as any);
    case 'task.delete':
      if (!p.id) throw new HttpError(400, 'task.delete requires payload.id');
      return tasksService.remove(p.id);
    case 'task.move':
      // deno-lint-ignore no-explicit-any
      return tasksService.move(p as any);
    case 'mood.log':
      // deno-lint-ignore no-explicit-any
      return moodService.log(p as any);
    case 'mood.reflect':
      if (!p.date) throw new HttpError(400, 'mood.reflect requires payload.date');
      // deno-lint-ignore no-explicit-any
      return moodService.reflect(p.date, p as any);
    case 'tag.create':
      // deno-lint-ignore no-explicit-any
      return tagsService.create(p as any);
    case 'tag.delete':
      if (!p.label) throw new HttpError(400, 'tag.delete requires payload.label');
      return tagsService.remove(p.label);
    case 'subject.create':
      // deno-lint-ignore no-explicit-any
      return subjectsService.create(p as any);
    case 'subject.patch': {
      const { id, ...data } = p;
      if (!id) throw new HttpError(400, 'subject.patch requires payload.id');
      // deno-lint-ignore no-explicit-any
      return subjectsService.update(id, data as any);
    }
    case 'subject.delete':
      if (!p.id) throw new HttpError(400, 'subject.delete requires payload.id');
      return subjectsService.remove(p.id);
    default:
      throw new HttpError(400, `Unsupported mutation type: ${m.type as string}`);
  }
}
