import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { ymd } from '../tasks/occurs-on';
import { TasksService } from '../tasks/tasks.service';
import { SubjectsService } from '../subjects/subjects.service';
import { MoodService } from '../mood/mood.service';
import { TagsService } from '../tags/tags.service';
import { SyncMutationDto, SyncMutationsDto } from './dto/sync.dto';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 14;

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly tasks: TasksService,
    private readonly subjects: SubjectsService,
    private readonly mood: MoodService,
    private readonly tags: TagsService,
  ) {}

  async cursor() {
    return { cursor: await this.dbNowMs() };
  }

  async changes(since?: string, from?: string, to?: string) {
    const sinceDate = new Date(since && since !== '' ? Number(since) : 0);
    const cursor = await this.dbNowMs();
    const db = this.prisma.tenant;
    const userId = this.rc.userId;

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
          courseUpserts.push(await this.subjects.get(c.id));
        } catch (e) {
          // Only a genuine not-found is a tombstone. Any other failure must
          // fail the sync request — silently tombstoning here tells every
          // client to DELETE a live subject locally.
          if (e instanceof NotFoundException) courseTombstones.push(c.id);
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
      start: s.start_date ? this.ymdDate(s.start_date) : '',
      end: s.end_date ? this.ymdDate(s.end_date) : '',
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
      this.prisma.taskRescheduleHistory.count({
        where: { created_at: { gt: sinceDate }, task: { user_id: userId } },
      }),
    ]);
    let taskDelta: { window: { from: string; to: string }; items: unknown[] } | null = null;
    if (tasksChanged > 0 || historyChanged > 0) {
      const start = from ?? ymd(new Date());
      const end = to ?? ymd(new Date(Date.now() + (DEFAULT_WINDOW_DAYS - 1) * MS_PER_DAY));
      taskDelta = { window: { from: start, to: end }, items: (await this.tasks.query({ from: start, to: end })).tasks };
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
  }

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
        const result = await this.applyMutation(m);
        results.push({ op_id: m.op_id, status: 'applied', result });
      } catch (e) {
        results.push({ op_id: m.op_id, status: 'failed', error: e instanceof Error ? e.message : 'Mutation failed' });
      }
    }
    const applied = results.filter((r) => r.status === 'applied').length;
    return { cursor: await this.dbNowMs(), applied, failed: results.length - applied, results };
  }

  private async applyMutation(m: SyncMutationDto): Promise<unknown> {
    const p = (m.payload ?? {}) as Record<string, any>;
    switch (m.type) {
      case 'task.create':
        return this.tasks.create(p as any);
      case 'task.patch': {
        const { id, ...data } = p;
        if (!id) throw new BadRequestException('task.patch requires payload.id');
        return this.tasks.patch(id, data as any);
      }
      case 'task.toggle':
        if (!p.id) throw new BadRequestException('task.toggle requires payload.id');
        return typeof p.done === 'boolean' ? this.tasks.setDone(p.id, p.done) : this.tasks.toggle(p.id, {} as any);
      case 'task.delete':
        if (!p.id) throw new BadRequestException('task.delete requires payload.id');
        return this.tasks.remove(p.id);
      case 'task.move':
        return this.tasks.move(p as any);
      case 'mood.log':
        return this.mood.log(p as any);
      case 'mood.reflect':
        if (!p.date) throw new BadRequestException('mood.reflect requires payload.date');
        return this.mood.reflect(p.date, p as any);
      case 'tag.create':
        return this.tags.create(p as any);
      case 'tag.delete':
        if (!p.label) throw new BadRequestException('tag.delete requires payload.label');
        return this.tags.remove(p.label);
      case 'subject.create':
        return this.subjects.create(p as any);
      case 'subject.patch': {
        const { id, ...data } = p;
        if (!id) throw new BadRequestException('subject.patch requires payload.id');
        return this.subjects.update(id, data as any);
      }
      case 'subject.delete':
        if (!p.id) throw new BadRequestException('subject.delete requires payload.id');
        return this.subjects.remove(p.id);
      default:
        throw new BadRequestException(`Unsupported mutation type: ${m.type as string}`);
    }
  }

  // ---- internals ---------------------------------------------------------

  private async dbNowMs(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ now: Date }>>`SELECT now() as now`;
    return rows[0].now.getTime();
  }

  private ymdDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
