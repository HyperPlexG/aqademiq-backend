import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { ymd } from '../tasks/occurs-on';
import { TasksService } from '../tasks/tasks.service';
import { SubjectsService } from '../subjects/subjects.service';

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 14;

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
        } catch {
          courseTombstones.push(c.id);
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
