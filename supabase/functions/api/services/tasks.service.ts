// §2.2/§4.2 — tasks CRUD + recurring-occurrence engine. Port of
// src/features/tasks/tasks.service.ts. The pure occurrence math lives in
// _shared/occurs-on.ts (imported, never re-copied). Public method names match
// the Nest service so peers (ada/focus/sync) can import tasksService.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { cacheDel, cacheGet, cacheSet } from '../../_shared/redis.ts';
import { revision } from '../../_shared/revision.ts';
import { claude } from '../../_shared/claude.ts';
import {
  dayDiff,
  occursOn,
  parseOccurrenceId,
  type SeriesLike,
  taskRowToSeries,
  toUtcDate,
  ymd,
} from '../../_shared/occurs-on.ts';

// The wire `category` carries the client's study-tag id and rides in the
// free-form `task_type` column so tag colouring round-trips. (The old CHECK
// constraint `tasks_task_type_check` is dropped in the accompanying migration —
// coercing arbitrary tag ids to 'other' was what made every custom tag render
// as "Other" on the plan.) An absent category keeps the column default.
const MS_PER_DAY = 86_400_000;
// How far before a task's scheduled start the "before task" reminder fires.
const REMINDER_LEAD_MS = 10 * 60 * 1000;
const RANGE_CAP_DAYS = 366;
const COMPLETIONS_TTL = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the wire `category` into the value we persist on `tasks.task_type`.
 *
 * Prefer a real study-tag id so the Plan UI can colour/label the chip. Accepts:
 * - study-tag UUID from the client
 * - study-tag label / Ada legacy enum (`assignment`, `exam`, …) matched by name
 * - any other free-form string (passthrough — never coerce to `other`)
 */
async function resolveTaskCategory(category?: string | null): Promise<string> {
  if (!category) return 'assignment';
  const trimmed = category.trim();
  if (!trimmed) return 'assignment';

  if (UUID_RE.test(trimmed)) {
    const byId = await tenantDb().studyTag.findFirst({ where: { id: trimmed } });
    return byId?.id ?? trimmed;
  }

  const byName = await tenantDb().studyTag.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (byName) return byName.id;

  return trimmed;
}

// ---- DTO shapes (mirror src/features/tasks/dto/tasks.dto.ts) ----
export interface RepeatRuleDto {
  kind: string;
  interval?: number;
}
export interface CreateTaskDto {
  title: string;
  subject_id?: string;
  duration_seconds?: number;
  scheduled_at?: string;
  category?: string;
  note?: string;
  date?: string;
  repeat?: RepeatRuleDto;
  until_date?: string;
  // Time-of-day bucket ("anytime"|"morning"|"afternoon"|"evening") for tasks
  // without a specific clock time. Persisted on tasks.planner_section.
  part_of_day?: string;
}
export interface QueryTasksDto {
  date?: string;
  from?: string;
  to?: string;
}
export interface PatchTaskDto {
  scheduled_at?: string;
  status?: string;
  title?: string;
  category?: string;
  note?: string;
  duration_seconds?: number;
  part_of_day?: string;
}
export interface ToggleTaskDto {
  date?: string;
}
export interface MoveTasksDto {
  from: string;
  to: string;
  ids?: string[];
}
export interface BreakdownDto {
  date?: string;
}

// ---- occurrence dto ----
interface OccurrenceStepDto {
  id: string;
  title: string;
  duration_seconds: number;
  status: string;
}
interface OccurrenceDto {
  id: string;
  title: string;
  subject_id: string | null;
  duration_seconds: number;
  scheduled_at: string | null;
  part_of_day: string;
  status: string;
  category: string;
  note: string | null;
  repeat: { kind: string; interval: number };
  steps: OccurrenceStepDto[];
}

function today(): string {
  return ymd(new Date());
}

function parseTimeStr(dateStr: string, hhmm: string | null): Date {
  const timeStr = hhmm ?? '00:00';
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

function formatTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return d instanceof Date ? d.toISOString().slice(11, 16) : String(d).slice(11, 16);
  } catch {
    return null;
  }
}

function fallbackStepRows(title: string, totalSeconds: number): Array<{ title: string; duration_seconds: number }> {
  const t = title.trim() || 'task';
  const titles = [`Plan: ${t}`, `Work on ${t}`, `Review ${t}`];
  const per = Math.max(0, Math.round(totalSeconds / titles.length));
  return titles.map((title) => ({ title, duration_seconds: per }));
}

function getSeriesLike(task: unknown): SeriesLike {
  return taskRowToSeries(task as Parameters<typeof taskRowToSeries>[0]);
}

// deno-lint-ignore no-explicit-any
function occurrenceDto(task: any, dateStr: string): OccurrenceDto {
  const repeatRule = typeof task.repeat_rule === 'string' ? JSON.parse(task.repeat_rule) : (task.repeat_rule ?? {});
  const repeatKind = repeatRule?.repeat_kind ?? 'none';
  const repeatInterval = repeatRule?.repeat_interval ?? 1;

  const hhmm = task.scheduled_start_at ? formatTime(task.scheduled_start_at) : null;
  const scheduled_at = hhmm ? `${dateStr}T${hhmm}:00` : null;
  const status = task.status === 'completed' ? 'COMPLETE' : 'PENDING';
  const steps = (task.steps ?? [])
    // deno-lint-ignore no-explicit-any
    .sort((a: any, b: any) => a.order_index - b.order_index)
    // deno-lint-ignore no-explicit-any
    .map((st: any) => ({
      id: st.id,
      title: st.title,
      duration_seconds: 0,
      status: st.status === 'completed' ? 'COMPLETE' : 'PENDING',
    }));

  const isVirtual = task.parent_task_id === null && !!task.repeat_rule;
  const stableId = isVirtual ? `${task.id}@${dateStr}` : task.id;

  return {
    id: stableId,
    title: task.title,
    subject_id: task.course_id,
    duration_seconds: (task.estimated_duration_mins ?? 5) * 60,
    scheduled_at,
    part_of_day: task.planner_section ?? 'anytime',
    status,
    category: task.task_type ?? 'general',
    note: task.description ?? null,
    repeat: { kind: repeatKind, interval: repeatInterval },
    steps,
  };
}

async function materializeRange(start: string, end: string): Promise<OccurrenceDto[]> {
  const startD = toUtcDate(start);
  const endD = toUtcDate(end);

  const allTasks = await tenantDb().task.findMany({
    where: {
      OR: [
        // One-offs or template tasks
        { parent_task_id: null },
        // Concrete override tasks in range
        {
          parent_task_id: { not: null },
          due_at: { gte: startD, lte: endD },
        },
      ],
    },
    include: { steps: true },
  });

  const concreteTasks = allTasks.filter((t) => !t.repeat_rule && t.parent_task_id === null);
  const templateTasks = allTasks.filter((t) => !!t.repeat_rule && t.parent_task_id === null);
  const overrideTasks = allTasks.filter((t) => t.parent_task_id !== null);

  const out = new Map<string, OccurrenceDto>();
  const spanDays = dayDiff(start, end);

  for (let i = 0; i <= spanDays; i++) {
    const dStr = ymd(new Date(startD.getTime() + i * MS_PER_DAY));

    // 1. Process concrete one-off tasks scheduled/due today
    for (const t of concreteTasks) {
      const matchesDate = (t.due_at && ymd(t.due_at) === dStr) || (t.scheduled_start_at && ymd(t.scheduled_start_at) === dStr);
      if (matchesDate && t.status !== 'cancelled') {
        const dto = occurrenceDto(t, dStr);
        out.set(dto.id, dto);
      }
    }

    // 2. Process template recurrences
    for (const t of templateTasks) {
      const series = getSeriesLike(t);
      if (occursOn(series, dStr)) {
        // Check if there is an override row for this template on this date
        const override = overrideTasks.find((o) => o.parent_task_id === t.id && o.due_at && ymd(o.due_at) === dStr);
        if (override) {
          if (override.status !== 'cancelled') {
            const dto = occurrenceDto(override, dStr);
            out.set(dto.id, dto);
          }
        } else {
          // Render virtual occurrence
          const dto = occurrenceDto(t, dStr);
          out.set(dto.id, dto);
        }
      }
    }

    // 3. Process override tasks that were moved into today
    for (const o of overrideTasks) {
      if (o.due_at && ymd(o.due_at) === dStr && o.status !== 'cancelled') {
        // If this override task matches today's date, render it
        const parent = templateTasks.find((p) => p.id === o.parent_task_id);
        if (parent) {
          const dto = occurrenceDto(o, dStr);
          out.set(dto.id, dto);
        }
      }
    }
  }

  return [...out.values()];
}

interface ResolvedOccurrence {
  // deno-lint-ignore no-explicit-any
  task: any;
  dateStr: string;
  isVirtual: boolean;
}

async function resolveOccurrence(occId: string): Promise<ResolvedOccurrence> {
  const parsed = parseOccurrenceId(occId);
  if (parsed) {
    if (!UUID_RE.test(parsed.seriesId)) {
      throw new HttpError(400, 'Invalid occurrence id — expected <task-id> or <task-id>@<yyyy-MM-dd>');
    }
    const task = await tenantDb().task.findUnique({
      where: { id: parsed.seriesId },
      include: { steps: true },
    });
    if (!task) throw new HttpError(404, 'Task template not found');
    return { task, dateStr: parsed.date, isVirtual: true };
  } else {
    if (!UUID_RE.test(occId)) {
      throw new HttpError(400, 'Invalid occurrence id — expected <task-id> or <task-id>@<yyyy-MM-dd>');
    }
    const task = await tenantDb().task.findUnique({
      where: { id: occId },
      include: { steps: true },
    });
    if (!task) throw new HttpError(404, 'Task not found');
    return { task, dateStr: task.due_at ? ymd(task.due_at) : today(), isVirtual: false };
  }
}

async function buildOne(taskId: string, dateStr: string): Promise<OccurrenceDto> {
  const task = await tenantDb().task.findUnique({
    where: { id: taskId },
    include: { steps: true },
  });
  if (!task) throw new HttpError(404, 'Task not found');
  return occurrenceDto(task, dateStr);
}

async function adjustActivitySnapshot(date: Date, diff: number): Promise<void> {
  await prismaBase().dailyActivitySnapshot.upsert({
    where: { user_id_activity_date: { user_id: RequestContext.userId, activity_date: date } },
    create: { user_id: RequestContext.userId, activity_date: date, tasks_completed: diff > 0 ? diff : 0 },
    update: { tasks_completed: { increment: diff } },
  });
}

async function invalidateCompletions(): Promise<void> {
  await cacheDel(`tasks:completions:${RequestContext.userId}`);
  await revision.bump(RequestContext.userId, 'tasks');
}

export const tasksService = {
  /** GET /tasks?date= | ?from=&to= */
  async query(q: QueryTasksDto) {
    let start: string;
    let end: string;
    if (q.from && q.to) {
      start = q.from;
      end = q.to;
      if (dayDiff(start, end) < 0) throw new HttpError(400, '`from` must be <= `to`');
      if (dayDiff(start, end) > RANGE_CAP_DAYS) {
        throw new HttpError(400, `range exceeds ${RANGE_CAP_DAYS}-day horizon cap`);
      }
    } else {
      start = end = q.date ?? today();
    }
    return { tasks: await materializeRange(start, end) };
  },

  /** POST /tasks */
  async create(dto: CreateTaskDto) {
    const db = tenantDb();

    let courseId = dto.subject_id;
    if (courseId) {
      const course = await db.course.findFirst({ where: { id: courseId } });
      if (!course) throw new HttpError(422, 'Unknown subject_id');
    } else {
      const first = await db.course.findFirst({ orderBy: { name: 'asc' } });
      if (!first) throw new HttpError(422, 'No subject available — create a subject first');
      courseId = first.id;
    }

    const anchorStr = dto.date ?? (dto.scheduled_at ? ymd(dto.scheduled_at) : today());
    const repeatRule = dto.repeat
      ? {
        repeat_kind: dto.repeat.kind,
        repeat_interval: dto.repeat.interval ?? 1,
        until_date: dto.until_date ? toUtcDate(dto.until_date) : null,
      }
      : null;

    const scheduledStart = dto.scheduled_at ? new Date(dto.scheduled_at) : parseTimeStr(anchorStr, null);
    const estimatedMins = dto.duration_seconds ? Math.max(1, Math.round(dto.duration_seconds / 60)) : 5;

    const created = await db.task.create({
      data: {
        course_id: courseId,
        title: dto.title,
        estimated_duration_mins: estimatedMins,
        scheduled_start_at: dto.scheduled_at ? scheduledStart : null,
        scheduled_end_at: dto.scheduled_at ? new Date(scheduledStart.getTime() + estimatedMins * 60 * 1000) : null,
        // A "before task" reminder fires REMINDER_LEAD_MS before the scheduled
        // start. Without this, tasks.reminder_at stayed null and the sweep never
        // had anything to send — the root cause of no push reminders arriving.
        // Date-only tasks (no scheduled time) get no before-task reminder.
        reminder_at: dto.scheduled_at ? new Date(scheduledStart.getTime() - REMINDER_LEAD_MS) : null,
        due_at: toUtcDate(anchorStr),
        task_type: await resolveTaskCategory(dto.category),
        description: dto.note ?? null,
        repeat_rule: repeatRule ? JSON.stringify(repeatRule) : null,
        planner_section: dto.part_of_day ?? 'anytime',
        status: 'pending',
        priority: 'medium',
        // deno-lint-ignore no-explicit-any
      } as any,
    });

    await invalidateCompletions();
    return occurrenceDto({ ...created, steps: [] }, anchorStr);
  },

  /** PATCH /tasks/:occ — edit one occurrence */
  async patch(occId: string, dto: PatchTaskDto) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);

    // deno-lint-ignore no-explicit-any
    const dbData: Record<string, any> = {};
    if (dto.scheduled_at !== undefined) {
      if (dto.scheduled_at) {
        const start = new Date(dto.scheduled_at);
        dbData.scheduled_start_at = start;
        const mins = task.estimated_duration_mins ?? 5;
        dbData.scheduled_end_at = new Date(start.getTime() + mins * 60 * 1000);
        // Reschedule the before-task reminder to match the new start. Clearing
        // the prior delivery lets it fire again for the new time.
        dbData.reminder_at = new Date(start.getTime() - REMINDER_LEAD_MS);
      } else {
        dbData.scheduled_start_at = null;
        dbData.scheduled_end_at = null;
        dbData.reminder_at = null;
      }
    }
    if (dto.status !== undefined) {
      dbData.status = dto.status === 'COMPLETE' ? 'completed' : 'pending';
      if (dbData.status === 'completed') {
        dbData.completed_at = new Date();
      } else {
        dbData.completed_at = null;
      }
    }
    // Editable fields (title / study-tag / note / duration / time-of-day).
    if (dto.title !== undefined) dbData.title = dto.title;
    if (dto.category !== undefined) dbData.task_type = await resolveTaskCategory(dto.category);
    if (dto.note !== undefined) dbData.description = dto.note || null;
    if (dto.part_of_day !== undefined) dbData.planner_section = dto.part_of_day || 'anytime';
    if (dto.duration_seconds !== undefined) {
      dbData.estimated_duration_mins = Math.max(1, Math.round(dto.duration_seconds / 60));
    }

    if (isVirtual) {
      // Materialize virtual task as a concrete instance override, carrying any
      // edited fields (title / tag / note / duration) from dbData.
      const mins = dbData.estimated_duration_mins ?? task.estimated_duration_mins ?? 5;
      const start = dbData.scheduled_start_at !== undefined
        ? dbData.scheduled_start_at
        : (task.scheduled_start_at ? parseTimeStr(dateStr, formatTime(task.scheduled_start_at)) : null);
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;
      const status = dbData.status !== undefined ? dbData.status : 'pending';

      const materialized = await prismaBase().task.create({
        data: {
          user_id: RequestContext.userId,
          course_id: task.course_id,
          title: dbData.title ?? task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          reminder_at: start ? new Date(start.getTime() - REMINDER_LEAD_MS) : null,
          due_at: toUtcDate(dateStr),
          status,
          priority: task.priority ?? 'medium',
          task_type: dbData.task_type ?? task.task_type ?? 'general',
          planner_section: dbData.planner_section ?? task.planner_section ?? 'anytime',
          description: dbData.description ?? task.description ?? null,
          completed_at: status === 'completed' ? new Date() : null,
        },
      });

      await invalidateCompletions();
      return buildOne(materialized.id, dateStr);
    } else {
      const updated = await prismaBase().task.update({
        where: { id: task.id },
        data: dbData,
      });
      await invalidateCompletions();
      return buildOne(updated.id, dateStr);
    }
  },

  /** PATCH /tasks/:occ/toggle */
  async toggle(occId: string, _q: ToggleTaskDto) {
    const { task, isVirtual } = await resolveOccurrence(occId);
    const nextDone = isVirtual ? true : task.status !== 'completed';
    return this.setDone(occId, nextDone);
  },

  /** Set one occurrence's done state idempotently */
  async setDone(occId: string, done: boolean) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);
    const status = done ? 'completed' : 'pending';
    const completedAt = done ? new Date() : null;

    // deno-lint-ignore no-explicit-any
    let targetTask: any = task;
    if (isVirtual) {
      const mins = task.estimated_duration_mins ?? 5;
      const start = task.scheduled_start_at ? parseTimeStr(dateStr, formatTime(task.scheduled_start_at)) : null;
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

      targetTask = await prismaBase().task.create({
        data: {
          user_id: RequestContext.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          due_at: toUtcDate(dateStr),
          status,
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
          completed_at: completedAt,
        },
      });
    } else {
      targetTask = await prismaBase().task.update({
        where: { id: task.id },
        data: { status, completed_at: completedAt },
      });
    }

    const eventDate = targetTask.due_at ?? toUtcDate(dateStr);
    await adjustActivitySnapshot(eventDate, done ? 1 : -1);

    await cacheDel(`streaks:current:${RequestContext.userId}`);
    await invalidateCompletions();
    return buildOne(targetTask.id, dateStr);
  },

  /** POST /tasks/move */
  async move(dto: MoveTasksDto) {
    let occIds = dto.ids;
    if (!occIds || occIds.length === 0) {
      const dayTasks = await materializeRange(dto.from, dto.from);
      occIds = dayTasks.map((t) => t.id);
    }
    const movedTo = toUtcDate(dto.to);
    let moved = 0;
    for (const occId of occIds) {
      const { task, dateStr, isVirtual } = await resolveOccurrence(occId).catch(() => ({ task: null, dateStr: '', isVirtual: false }));
      if (!task || task.status === 'cancelled') continue;

      if (isVirtual) {
        const mins = task.estimated_duration_mins ?? 5;
        const start = task.scheduled_start_at ? parseTimeStr(dto.to, formatTime(task.scheduled_start_at)) : null;
        const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

        await prismaBase().task.create({
          data: {
            user_id: RequestContext.userId,
            course_id: task.course_id,
            title: task.title,
            parent_task_id: task.id,
            estimated_duration_mins: mins,
            scheduled_start_at: start,
            scheduled_end_at: end,
            due_at: movedTo,
            status: 'pending',
            priority: task.priority ?? 'medium',
            task_type: task.task_type ?? 'general',
          },
        });

        // Cancel the original occurrence slot so it doesn't render twice
        await prismaBase().task.create({
          data: {
            user_id: RequestContext.userId,
            course_id: task.course_id,
            title: task.title,
            parent_task_id: task.id,
            estimated_duration_mins: mins,
            due_at: toUtcDate(dateStr),
            status: 'cancelled',
            priority: task.priority ?? 'medium',
            task_type: task.task_type ?? 'general',
          },
        });
      } else {
        await prismaBase().task.update({
          where: { id: task.id },
          data: { due_at: movedTo },
        });
        // Log in rescheduled history
        await prismaBase().taskRescheduleHistory.create({
          data: {
            task_id: task.id,
            old_scheduled_start_at: task.scheduled_start_at,
            old_scheduled_end_at: task.scheduled_end_at,
            new_scheduled_start_at: movedTo,
            new_scheduled_end_at: null,
            reason: 'User moved task',
            changed_by: 'user',
          },
        });
      }
      moved++;
    }
    await invalidateCompletions();
    return { moved, from: dto.from, to: dto.to };
  },

  /** DELETE /tasks/:occ */
  async remove(occId: string) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);
    if (isVirtual) {
      // Materialize as cancelled/tombstone
      const mins = task.estimated_duration_mins ?? 5;
      await prismaBase().task.create({
        data: {
          user_id: RequestContext.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          due_at: toUtcDate(dateStr),
          status: 'cancelled',
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
        },
      });
    } else {
      await prismaBase().task.update({
        where: { id: task.id },
        data: { status: 'cancelled' },
      });
    }
    await invalidateCompletions();
    return { status: 'deleted', id: occId };
  },

  /** POST /tasks/:occ/breakdown */
  async breakdown(occId: string, _dto: BreakdownDto) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);
    let targetTaskId = task.id;

    if (isVirtual) {
      // Materialize virtual task to attach steps
      const mins = task.estimated_duration_mins ?? 5;
      const start = task.scheduled_start_at ? parseTimeStr(dateStr, formatTime(task.scheduled_start_at)) : null;
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

      const materialized = await prismaBase().task.create({
        data: {
          user_id: RequestContext.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          due_at: toUtcDate(dateStr),
          status: 'pending',
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
        },
      });
      targetTaskId = materialized.id;
    }

    const durationSeconds = (task.estimated_duration_mins ?? 5) * 60;
    let steps: Array<{ title: string; duration_seconds: number }>;
    if (claude.isConfigured()) {
      try {
        steps = await claude.breakdownSteps(task.title, durationSeconds);
      } catch {
        steps = fallbackStepRows(task.title, durationSeconds);
      }
    } else {
      steps = fallbackStepRows(task.title, durationSeconds);
    }

    const rows = steps.map((s, i) => ({
      task_id: targetTaskId,
      title: s.title,
      status: 'pending',
      order_index: i,
    }));

    await prismaBase().taskStep.createMany({ data: rows });
    const createdSteps = await prismaBase().taskStep.findMany({ where: { task_id: targetTaskId } });

    return {
      steps: createdSteps.map((s) => ({
        id: s.id,
        title: s.title,
        duration_seconds: 0,
        status: s.status === 'completed' ? 'COMPLETE' : 'PENDING',
      })),
    };
  },

  /** GET /tasks/history/completions */
  async completions() {
    const cacheKey = `tasks:completions:${RequestContext.userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const snapshots = await tenantDb().dailyActivitySnapshot.findMany({
      select: { activity_date: true, tasks_completed: true },
    });
    const counts: Record<string, number> = {};
    for (const s of snapshots) {
      if (s.tasks_completed > 0) {
        counts[ymd(s.activity_date)] = s.tasks_completed;
      }
    }
    await cacheSet(cacheKey, JSON.stringify(counts), COMPLETIONS_TTL);
    return counts;
  },
};
