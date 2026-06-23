import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { ymd } from '../tasks/occurs-on';
import { TasksService } from '../tasks/tasks.service';
import { SubjectsService } from '../subjects/subjects.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 14;

/**
 * §4.6 — incremental delta sync. The cursor is the database clock (ms); each
 * collection returns rows whose `updated_at > since`, split into upserts and
 * tombstones (soft-deleted rows). Tasks are materialized occurrences, so the
 * day window is re-sent only when any series/override changed since the cursor.
 *
 * The WS revision stream (RevisionService) is the change *signal*; clients then
 * call this with their last cursor to pull the delta. `POST /mutations` remains
 * deferred — clients use per-feature endpoints with an Idempotency-Key header.
 */
@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly tasks: TasksService,
    private readonly subjects: SubjectsService,
  ) {}

  async cursor() {
    return { cursor: await this.dbNowMs() };
  }

  async changes(since?: string, from?: string, to?: string) {
    const sinceDate = new Date(since && since !== '' ? Number(since) : 0);
    const cursor = await this.dbNowMs();
    const db = this.prisma.tenant;
    const userId = this.rc.userId;

    // --- subjects (full DTO for upserts; ids for tombstones) ---
    const subjectRows = await db.subject.findMany({ where: { updated_at: { gt: sinceDate } }, select: { id: true, deleted_at: true } });
    const subjectUpserts = [];
    const subjectTombstones: string[] = [];
    for (const s of subjectRows) {
      if (s.deleted_at) subjectTombstones.push(s.id);
      else subjectUpserts.push(await this.subjects.get(s.id));
    }

    // --- semesters ---
    const activeId = (
      await this.prisma.user.findUnique({ where: { id: userId }, select: { active_semester_id: true } })
    )?.active_semester_id ?? null;
    const semesterRows = await db.semester.findMany({ where: { updated_at: { gt: sinceDate } } });
    const semesterUpserts = semesterRows
      .filter((s) => !s.deleted_at)
      .map((s) => ({ id: s.id, name: s.name, start: this.ymdDate(s.start), end: this.ymdDate(s.end), is_active: s.id === activeId }));
    const semesterTombstones = semesterRows.filter((s) => s.deleted_at).map((s) => s.id);

    // --- tags (hard-deleted; no tombstone trail without a change log) ---
    const tagRows = await db.studyTag.findMany({ where: { updated_at: { gt: sinceDate } } });
    const tags = tagRows.map((t) => ({ id: t.id, label: t.label, color: t.color }));

    // --- mood ---
    const moodRows = await db.moodEntry.findMany({ where: { updated_at: { gt: sinceDate } } });
    const mood = moodRows.map((m) => ({ date: ymd(m.date), mood_index: m.mood_index, intention: m.intention, reflection: m.reflection }));

    // --- tasks: re-send the window only if any series/override changed ---
    const [seriesChanged, overrideChanged] = await Promise.all([
      db.taskSeries.count({ where: { updated_at: { gt: sinceDate } } }),
      this.prisma.occurrenceOverride.count({ where: { updated_at: { gt: sinceDate }, series: { user_id: userId } } }),
    ]);
    let taskDelta: { window: { from: string; to: string }; items: unknown[] } | null = null;
    if (seriesChanged > 0 || overrideChanged > 0) {
      const start = from ?? ymd(new Date());
      const end = to ?? ymd(new Date(Date.now() + (DEFAULT_WINDOW_DAYS - 1) * MS_PER_DAY));
      taskDelta = { window: { from: start, to: end }, items: (await this.tasks.query({ from: start, to: end })).tasks };
    }

    return {
      cursor,
      changes: {
        subjects: { upserts: subjectUpserts, tombstones: subjectTombstones },
        semesters: { upserts: semesterUpserts, tombstones: semesterTombstones },
        tags: { upserts: tags },
        mood: { upserts: mood },
        tasks: taskDelta,
      },
    };
  }

  mutations() {
    throw new NotImplementedException(
      'Batch /sync/mutations is deferred — use the per-feature endpoints with an Idempotency-Key header.',
    );
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
