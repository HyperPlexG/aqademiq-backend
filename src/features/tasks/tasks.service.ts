import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { RevisionService } from '../../infra/revision.service';
import { ClaudeService } from '../../infra/claude.service';
import { RequestContext } from '../../common/request-context';
import { occursOn, parseOccurrenceId, toUtcDate, ymd, dayDiff } from './occurs-on';
import { CreateTaskDto, QueryTasksDto, PatchTaskDto, ToggleTaskDto, MoveTasksDto, BreakdownDto } from './dto/tasks.dto';

const MS_PER_DAY = 86_400_000;
const RANGE_CAP_DAYS = 366; // §4.2 horizon cap for open range queries
const COMPLETIONS_TTL = 300;

type OverrideRow = {
  series_id: string;
  occurrence_date: Date;
  kind: string;
  status: string | null;
  scheduled_at: string | null;
  moved_to_date: Date | null;
};

/**
 * §2.2/§4.2 — the recurring-task engine. Series + RepeatRule are stored; daily
 * occurrences are materialized lazily via `occursOn` (pure, see occurs-on.ts).
 * Divergence lives in OccurrenceOverride keyed `(series_id, occurrence_date)`,
 * which is both a generation cache and a DELETED tombstone. Occurrence ids are
 * deterministic `{series_id}@{yyyy-MM-dd}`.
 *
 * Tenant scoping: TaskSeries/Subject go through `prisma.tenant.*` (auto user_id
 * filter). OccurrenceOverride/TaskStep are not tenant models, so every mutation
 * first verifies series ownership via `loadOwnedSeries`.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
    private readonly claude: ClaudeService,
  ) {}

  /** GET /tasks?date= | ?from=&to= — day / range materialization (§4.2). */
  async query(q: QueryTasksDto) {
    let start: string;
    let end: string;
    if (q.from && q.to) {
      start = q.from;
      end = q.to;
      if (dayDiff(start, end) < 0) throw new BadRequestException('`from` must be <= `to`');
      if (dayDiff(start, end) > RANGE_CAP_DAYS) {
        throw new BadRequestException(`range exceeds ${RANGE_CAP_DAYS}-day horizon cap`);
      }
    } else {
      start = end = q.date ?? this.today();
    }
    return { tasks: await this.materializeRange(start, end) };
  }

  /** POST /tasks — quick-add or full form. Validates subject_id (422 if unknown). */
  async create(dto: CreateTaskDto) {
    const db = this.prisma.tenant;

    let subjectId = dto.subject_id;
    if (subjectId) {
      const subj = await db.subject.findFirst({ where: { id: subjectId, deleted_at: null } });
      if (!subj) throw new UnprocessableEntityException('Unknown subject_id');
    } else {
      const first = await db.subject.findFirst({ where: { deleted_at: null }, orderBy: { name: 'asc' } });
      if (!first) throw new UnprocessableEntityException('No subject available — create a subject first');
      subjectId = first.id;
    }

    const anchorStr = dto.date ?? (dto.scheduled_at ? ymd(dto.scheduled_at) : this.today());
    const created = await db.taskSeries.create({
      // user_id is injected by the tenant extension at runtime; cast satisfies
      // the static type, which still expects it on the create input.
      data: {
        subject_id: subjectId,
        title: dto.title,
        duration_seconds: dto.duration_seconds ?? 300,
        scheduled_at: dto.scheduled_at ?? null,
        category: dto.category ?? null,
        anchor_date: toUtcDate(anchorStr),
        repeat_kind: dto.repeat?.kind ?? 'none',
        repeat_interval: dto.repeat?.interval ?? 1,
        until_date: dto.until_date ? toUtcDate(dto.until_date) : null,
      } as any,
    });

    await this.invalidateCompletions();
    return this.occurrenceDto({ ...created, steps: [] }, anchorStr, null);
  }

  /** PATCH /tasks/:occ — edit one occurrence (EDITED override). */
  async patch(occId: string, dto: PatchTaskDto) {
    const { series, dateStr, existing } = await this.resolveOccurrence(occId, { requireExists: true });
    const occurrence_date = toUtcDate(dateStr);

    const data: Record<string, unknown> = {};
    if (dto.scheduled_at !== undefined) data.scheduled_at = dto.scheduled_at;
    if (dto.status !== undefined) data.status = dto.status;
    if (Object.keys(data).length === 0) return this.buildOne(series, dateStr);

    const kind = existing && existing.kind !== 'DONE' ? existing.kind : 'EDITED';
    await this.prisma.occurrenceOverride.upsert({
      where: { series_id_occurrence_date: { series_id: series.id, occurrence_date } },
      create: { series_id: series.id, occurrence_date, kind, ...data },
      update: { kind, ...data },
    });
    await this.invalidateCompletions();
    return this.buildOne(series, dateStr);
  }

  /** PATCH /tasks/:occ/toggle — flip done on one occurrence; siblings unaffected. */
  async toggle(occId: string, _q: ToggleTaskDto) {
    const { existing } = await this.resolveOccurrence(occId, { requireExists: true });
    return this.setDone(occId, existing?.status !== 'COMPLETE');
  }

  /**
   * Set one occurrence's done state idempotently, keeping the §4.7 activity
   * ledger in sync (so completions feed the streak). Shared by toggle and the
   * focus-session "task-done sync" (§2.4).
   */
  async setDone(occId: string, done: boolean) {
    const { series, dateStr, existing } = await this.resolveOccurrence(occId, { requireExists: true });
    const next = done ? 'COMPLETE' : 'PENDING';
    await this.writeStatus(series.id, dateStr, existing, next);

    // event_date is the occurrence's effective day (its moved-to date if moved).
    const eventDate = existing?.moved_to_date ?? toUtcDate(dateStr);
    if (next === 'COMPLETE') {
      await this.prisma.activityEvent.upsert({
        where: { user_id_source_ref_id: { user_id: this.rc.userId, source: 'task_completion', ref_id: occId } },
        create: { user_id: this.rc.userId, source: 'task_completion', ref_id: occId, event_date: eventDate },
        update: { event_date: eventDate },
      });
    } else {
      await this.prisma.activityEvent.deleteMany({
        where: { user_id: this.rc.userId, source: 'task_completion', ref_id: occId },
      });
    }
    await this.redis.client.del(`streaks:current:${this.rc.userId}`);
    await this.invalidateCompletions();
    return this.buildOne(series, dateStr);
  }

  /** POST /tasks/move — move occurrences from→to (preserves wall-clock time). */
  async move(dto: MoveTasksDto) {
    let occIds = dto.ids;
    if (!occIds || occIds.length === 0) {
      const dayTasks = await this.materializeRange(dto.from, dto.from);
      occIds = dayTasks.map((t) => t.id);
    }
    const movedTo = toUtcDate(dto.to);
    let moved = 0;
    for (const occId of occIds) {
      const parsed = parseOccurrenceId(occId);
      if (!parsed) continue;
      const series = await this.loadOwnedSeries(parsed.seriesId);
      if (!series) continue;
      const occurrence_date = toUtcDate(parsed.date);
      const existing = await this.findOverride(parsed.seriesId, parsed.date);
      if (existing?.kind === 'DELETED') continue;
      await this.prisma.occurrenceOverride.upsert({
        where: { series_id_occurrence_date: { series_id: parsed.seriesId, occurrence_date } },
        create: { series_id: parsed.seriesId, occurrence_date, kind: 'MOVED', moved_to_date: movedTo },
        update: { kind: 'MOVED', moved_to_date: movedTo },
      });
      moved++;
    }
    // TODO(§4.5): cancel + re-enqueue reminder jobs for the moved occurrences.
    await this.invalidateCompletions();
    return { moved, from: dto.from, to: dto.to };
  }

  /** DELETE /tasks/:occ — tombstone override; prevents regeneration forever (§4.2). */
  async remove(occId: string) {
    const { series, dateStr } = await this.resolveOccurrence(occId, { requireExists: false });
    const occurrence_date = toUtcDate(dateStr);
    await this.prisma.occurrenceOverride.upsert({
      where: { series_id_occurrence_date: { series_id: series.id, occurrence_date } },
      create: { series_id: series.id, occurrence_date, kind: 'DELETED' },
      update: { kind: 'DELETED', moved_to_date: null },
    });
    await this.invalidateCompletions();
    return { status: 'deleted', id: occId };
  }

  /** POST /tasks/:occ/breakdown — Claude Haiku 4.5 structured microsteps when
   *  configured, regex/template fallback otherwise (or on any LLM error). */
  async breakdown(occId: string, _dto: BreakdownDto) {
    const { series, dateStr } = await this.resolveOccurrence(occId, { requireExists: false });
    const ts = Date.now();
    const occurrence_date = toUtcDate(dateStr);

    let steps: Array<{ title: string; duration_seconds: number }>;
    if (this.claude.isConfigured()) {
      try {
        steps = await this.claude.breakdownSteps(series.title, series.duration_seconds || 0);
      } catch {
        steps = this.fallbackStepRows(series.title, series.duration_seconds || 0);
      }
    } else {
      steps = this.fallbackStepRows(series.title, series.duration_seconds || 0);
    }

    const rows = steps.map((s, i) => ({
      id: `${occId}-bd${ts}-${i}`,
      series_id: series.id,
      occurrence_date,
      title: s.title,
      duration_seconds: s.duration_seconds,
      status: 'PENDING',
      order_idx: i,
    }));
    await this.prisma.taskStep.createMany({ data: rows });
    return { steps: rows.map((s) => ({ id: s.id, title: s.title, duration_seconds: s.duration_seconds, status: s.status })) };
  }

  /** GET /tasks/history/completions — { 'yyyy-MM-dd': count } heatmap (cached). */
  async completions() {
    const cacheKey = `tasks:completions:${this.rc.userId}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const series = await this.prisma.tenant.taskSeries.findMany({
      where: { deleted_at: null },
      select: { overrides: { where: { status: 'COMPLETE' }, select: { occurrence_date: true, moved_to_date: true } } },
    });
    const counts: Record<string, number> = {};
    for (const s of series) {
      for (const ov of s.overrides) {
        const d = ymd(ov.moved_to_date ?? ov.occurrence_date);
        counts[d] = (counts[d] ?? 0) + 1;
      }
    }
    await this.redis.client.set(cacheKey, JSON.stringify(counts), 'EX', COMPLETIONS_TTL);
    return counts;
  }

  // ---- internals ---------------------------------------------------------

  /** Materialize every occurrence in [start, end] inclusive, applying overrides. */
  private async materializeRange(start: string, end: string) {
    const startD = toUtcDate(start);
    const endD = toUtcDate(end);
    const series = await this.prisma.tenant.taskSeries.findMany({
      where: {
        deleted_at: null,
        OR: [
          { AND: [{ anchor_date: { lte: endD } }, { OR: [{ until_date: null }, { until_date: { gte: startD } }] }] },
          { overrides: { some: { moved_to_date: { gte: startD, lte: endD } } } },
        ],
      },
      include: {
        steps: true,
        overrides: {
          where: {
            OR: [{ occurrence_date: { gte: startD, lte: endD } }, { moved_to_date: { gte: startD, lte: endD } }],
          },
        },
      },
    });

    const out = new Map<string, ReturnType<TasksService['occurrenceDto']>>();
    const spanDays = dayDiff(start, end);
    for (let i = 0; i <= spanDays; i++) {
      const dStr = ymd(new Date(startD.getTime() + i * MS_PER_DAY));
      for (const s of series) {
        const ovDay = (s.overrides as OverrideRow[]).find((o) => ymd(o.occurrence_date) === dStr);

        // (a) natural occurrence on this day, unless tombstoned or moved away.
        if (occursOn(s, dStr)) {
          const movedAway = ovDay?.kind === 'MOVED' && ovDay.moved_to_date && ymd(ovDay.moved_to_date) !== dStr;
          if (ovDay?.kind !== 'DELETED' && !movedAway) {
            const dto = this.occurrenceDto(s, dStr, ovDay ?? null);
            out.set(dto.id, dto);
          }
        }

        // (b) occurrences moved INTO this day (rendered under their stable id).
        for (const ov of s.overrides as OverrideRow[]) {
          if (ov.kind === 'MOVED' && ov.moved_to_date && ymd(ov.moved_to_date) === dStr) {
            const dto = this.occurrenceDto(s, ymd(ov.occurrence_date), ov);
            out.set(dto.id, dto);
          }
        }
      }
    }
    return [...out.values()];
  }

  private occurrenceDto(series: any, occDateStr: string, override: OverrideRow | null) {
    const status = override?.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING';
    const scheduled_at = override?.scheduled_at ?? series.scheduled_at ?? null;
    const steps = (series.steps ?? [])
      .filter((st: any) => st.occurrence_date == null || ymd(st.occurrence_date) === occDateStr)
      .sort((a: any, b: any) => a.order_idx - b.order_idx)
      .map((st: any) => ({ id: st.id, title: st.title, duration_seconds: st.duration_seconds, status: st.status }));
    return {
      id: `${series.id}@${occDateStr}`,
      title: series.title,
      subject_id: series.subject_id,
      duration_seconds: series.duration_seconds,
      scheduled_at,
      status,
      category: series.category ?? null,
      repeat: { kind: series.repeat_kind, interval: series.repeat_interval },
      steps,
    };
  }

  /** Resolve an occurrence id to its owned series; optionally require the
   *  occurrence to actually exist (occurs naturally or has a non-tombstone override). */
  private async resolveOccurrence(occId: string, opts: { requireExists: boolean }) {
    const parsed = parseOccurrenceId(occId);
    if (!parsed) throw new BadRequestException('Malformed occurrence id');
    const series = await this.loadOwnedSeries(parsed.seriesId);
    if (!series) throw new NotFoundException('Task not found');
    const existing = await this.findOverride(parsed.seriesId, parsed.date);
    if (existing?.kind === 'DELETED') throw new NotFoundException('Occurrence deleted');
    if (opts.requireExists && !occursOn(series, parsed.date) && !existing) {
      throw new NotFoundException('No such occurrence');
    }
    return { series, dateStr: parsed.date, existing };
  }

  private async writeStatus(seriesId: string, dateStr: string, existing: OverrideRow | null, status: string) {
    const occurrence_date = toUtcDate(dateStr);
    const keepDivergence = existing && (existing.scheduled_at || existing.moved_to_date);
    if (status === 'PENDING' && !keepDivergence) {
      if (existing) {
        await this.prisma.occurrenceOverride.delete({
          where: { series_id_occurrence_date: { series_id: seriesId, occurrence_date } },
        });
      }
      return;
    }
    const kind = existing && existing.kind !== 'DONE' ? existing.kind : 'DONE';
    await this.prisma.occurrenceOverride.upsert({
      where: { series_id_occurrence_date: { series_id: seriesId, occurrence_date } },
      create: { series_id: seriesId, occurrence_date, kind, status },
      update: { kind, status },
    });
  }

  private async buildOne(series: any, occDateStr: string) {
    const occurrence_date = toUtcDate(occDateStr);
    const [ov, steps] = await Promise.all([
      this.prisma.occurrenceOverride.findUnique({
        where: { series_id_occurrence_date: { series_id: series.id, occurrence_date } },
      }),
      this.prisma.taskStep.findMany({
        where: { series_id: series.id, OR: [{ occurrence_date }, { occurrence_date: null }] },
      }),
    ]);
    return this.occurrenceDto({ ...series, steps }, occDateStr, ov as OverrideRow | null);
  }

  private loadOwnedSeries(seriesId: string) {
    return this.prisma.tenant.taskSeries.findFirst({ where: { id: seriesId, deleted_at: null } });
  }

  private findOverride(seriesId: string, dateStr: string) {
    return this.prisma.occurrenceOverride.findUnique({
      where: { series_id_occurrence_date: { series_id: seriesId, occurrence_date: toUtcDate(dateStr) } },
    }) as Promise<OverrideRow | null>;
  }

  private fallbackStepRows(title: string, totalSeconds: number): Array<{ title: string; duration_seconds: number }> {
    const t = title.trim() || 'task';
    const titles = [`Plan: ${t}`, `Work on ${t}`, `Review ${t}`];
    const per = Math.max(0, Math.round(totalSeconds / titles.length));
    return titles.map((title) => ({ title, duration_seconds: per }));
  }

  /** Called by every task mutation: drop the completions cache and bump the
   *  per-user revision (advances the sync cursor + pushes a WS invalidation). */
  private async invalidateCompletions() {
    await this.redis.client.del(`tasks:completions:${this.rc.userId}`);
    await this.rev.bump(this.rc.userId, 'tasks');
  }

  private today(): string {
    return ymd(new Date());
  }
}
