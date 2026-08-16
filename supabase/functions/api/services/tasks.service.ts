// §2.2/§4.2 — tasks CRUD + recurring-occurrence engine. Port of
// src/features/tasks/tasks.service.ts. The pure occurrence math lives in
// _shared/occurs-on.ts (imported, never re-copied). Public method names match
// the Nest service so peers (ada/focus/sync) can import tasksService.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { cacheDel, cacheGet, cacheSet } from '../../_shared/redis.ts';
import { revision } from '../../_shared/revision.ts';
import { type BreakdownContext, type BreakdownStep, claude } from '../../_shared/claude.ts';
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
  /**
   * Steps supplied by the caller instead of generated here.
   *
   * This is the path Ada uses. The agent already holds the subject, the user's
   * memories, the conversation and any attached material — far more than this
   * service can reconstruct from a task row — and its steps have been through
   * the confirmation gate, so the user has already seen and approved the exact
   * wording. Generating here would throw all of that away and ask a small model
   * to guess from the title.
   */
  steps?: Array<{ title: string; detail?: string; duration_seconds?: number }>;
  /**
   * "Break down more" — go finer rather than regenerating the same shape.
   *
   * The existing steps are handed to the model and it is asked to split each of
   * them, so the result is genuinely more detailed. Without this the button
   * produced another breakdown at the same granularity, which read as doing
   * nothing at all.
   */
  refine?: boolean;
}

// ---- occurrence dto ----
interface OccurrenceStepDto {
  id: string;
  title: string;
  /** One line on what finishing this step looks like. Null when not set. */
  detail?: string | null;
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

/** Whole days from `dateStr` to the task's due date; null when it has none. */
function daysUntil(dueAt: Date | null | undefined, dateStr: string): number | null {
  if (!dueAt) return null;
  return dayDiff(dateStr, ymd(dueAt));
}

/**
 * Used only when the model is unavailable or produced boilerplate.
 *
 * This used to be `Plan: X` / `Work on X` / `Review X`, which fits literally
 * any task and so told the user nothing — and because it also ran whenever the
 * provider was rate-limited, it was what most people actually saw. Keying off
 * `task_type` at least produces the shape of the work: an essay, a problem set
 * and a lab report do not decompose the same way.
 *
 * Still a template, and deliberately the last resort — Ada supplies real steps
 * on its own path (BreakdownDto.steps), and this only backs the app's button.
 */
function fallbackStepRows(ctx: BreakdownContext): BreakdownStep[] {
  const type = (ctx.taskType ?? '').toLowerCase();
  const of = ctx.subject ? ` for ${ctx.subject}` : '';

  const byType: Array<[RegExp, string[]]> = [
    [/essay|report|writ|paper|thesis|dissert/, [
      'Decide the argument and jot the section headings',
      'Draft the body sections from your notes',
      'Tighten the intro and conclusion, then proofread',
    ]],
    [/lab|experiment|practical/, [
      'Write up the method and what you measured',
      'Work through the calculations and plot the results',
      'Interpret the results and note sources of error',
    ]],
    [/problem|assignment|homework|pset|exercise/, [
      'Read the questions and mark which need which technique',
      'Work the straightforward questions first',
      'Attack the ones you flagged, then check your answers',
    ]],
    [/exam|test|quiz|midterm|final|revis/, [
      'List the topics on the syllabus and rate your confidence',
      'Work through the weakest topics with practice questions',
      'Do a timed past paper under exam conditions',
    ]],
    [/read|chapter|paper|article/, [
      'Skim headings and the summary to get the shape',
      'Read closely and take notes in your own words',
      'Write three sentences on what it argued',
    ]],
    [/present|slide|talk|demo|poster/, [
      'Outline the story you want to tell',
      'Build the slides for each beat of it',
      'Rehearse aloud once and cut whatever runs long',
    ]],
  ];

  const titles = byType.find(([re]) => re.test(type))?.[1] ?? [
    `Work out exactly what "${ctx.title.trim()}" needs${of}`,
    'Do the main part of the work',
    'Check it over and note anything unfinished',
  ];

  const per = Math.max(0, Math.round(ctx.totalSeconds / titles.length));
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
      detail: st.description ?? null,
      duration_seconds: st.estimated_seconds ?? 0,
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
  async breakdown(occId: string, dto: BreakdownDto) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);
    let targetTaskId = task.id;

    if (isVirtual) {
      // Reuse the row a previous breakdown already materialised for this date.
      // Creating unconditionally meant breaking a repeating task down twice made
      // a SECOND child row, splitting its steps across two occurrences of the
      // same day — invisible in the UI, which reads only one of them.
      const existingChild = await tenantDb().task.findFirst({
        where: { parent_task_id: task.id, due_at: toUtcDate(dateStr) },
        select: { id: true },
      });
      if (existingChild) targetTaskId = existingChild.id;
    }

    if (isVirtual && targetTaskId === task.id) {
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
    let steps: BreakdownStep[];

    if (dto.steps?.length) {
      // Caller-supplied (Ada). Already confirmed by the user, so it is taken as
      // written rather than re-generated or "improved".
      steps = dto.steps
        .map((s) => ({
          title: String(s.title ?? '').trim().slice(0, 500),
          detail: s.detail?.trim() ? s.detail.trim().slice(0, 2000) : undefined,
          duration_seconds: Number.isFinite(s.duration_seconds)
            ? Math.max(0, Math.min(86_400, Math.round(s.duration_seconds!)))
            : 0,
        }))
        .filter((s) => s.title.length > 0);
    } else {
      // No steps given — the app's own "break this down" button. Generate, but
      // with the task's real context rather than just its title.
      const subject = task.course_id
        ? await tenantDb().course.findFirst({ where: { id: task.course_id } })
        : null;
      // "Break down more": show the model what the task already has so it can
      // split those rather than restate them.
      const current = dto.refine
        ? (await prismaBase().taskStep.findMany({
          where: { task_id: targetTaskId },
          orderBy: { order_index: 'asc' },
          select: { title: true },
        })).map((r: { title: string }) => r.title)
        : [];

      const ctx = {
        title: task.title,
        totalSeconds: durationSeconds,
        subject: subject?.name ?? null,
        taskType: task.task_type ?? null,
        notes: task.description ?? null,
        dueInDays: daysUntil(task.due_at, dateStr),
        priority: task.priority ?? null,
        ...(current.length ? { existing: current } : {}),
      };
      steps = [];
      if (claude.isConfigured()) {
        try {
          steps = await claude.breakdownSteps(ctx);
        } catch {
          // Includes the boilerplate rejection — treated as a failed call.
          steps = [];
        }
      }
      // Refining must never fall back to the type-aware template: the user
      // already has real steps, and replacing them with a generic three would
      // be worse than doing nothing. Fail loudly so the client can say so and
      // leave what they have untouched.
      if (steps.length === 0 && current.length) {
        throw new HttpError(503, "Couldn't add more detail right now. Your existing steps are unchanged.");
      }
      if (steps.length === 0) steps = fallbackStepRows(ctx);
    }

    if (steps.length === 0) throw new HttpError(400, 'No usable steps to add.');

    const rows = steps.map((s, i) => ({
      task_id: targetTaskId,
      title: s.title,
      description: s.detail ?? null,
      estimated_seconds: s.duration_seconds > 0 ? s.duration_seconds : null,
      status: 'pending',
      order_index: i,
    }));

    // REPLACE, never append. Breaking a task down twice used to stack a second
    // set on top of the first, so a task that had been through the old
    // boilerplate fallback and then a real breakdown showed both — "Plan: hello
    // / Work on hello / Review hello" sitting above the genuine steps, with the
    // count climbing every time anyone tried again. Re-running is now the fix
    // for a bad breakdown rather than another way to make it worse.
    //
    // Same transaction as the insert: a delete that succeeded while the insert
    // failed would leave the task with no steps at all.
    await prismaBase().$transaction([
      prismaBase().taskStep.deleteMany({ where: { task_id: targetTaskId } }),
      prismaBase().taskStep.createMany({ data: rows }),
    ]);
    const createdSteps = await prismaBase().taskStep.findMany({
      where: { task_id: targetTaskId },
      orderBy: { order_index: 'asc' },
    });

    return {
      steps: createdSteps.map((s) => ({
        id: s.id,
        title: s.title,
        detail: s.description ?? null,
        duration_seconds: s.estimated_seconds ?? 0,
        status: s.status === 'completed' ? 'COMPLETE' : 'PENDING',
      })),
    };
  },

  /**
   * PATCH /tasks/:occ/steps/:stepId — tick a microstep off, or un-tick it.
   *
   * There was no way to do this at all: steps were rendered with a circle that
   * looked tappable and did nothing, so a breakdown could be read but never
   * worked through. `done` is sent explicitly rather than toggled server-side so
   * a retried request cannot flip the step back.
   */
  async setStepDone(occId: string, stepId: string, done: boolean) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);

    // Ownership: task_steps carries no user_id, so the step is only safe to
    // touch because its task id came back from a tenant-scoped lookup. The
    // step must belong to THIS occurrence — otherwise any step id in the
    // database could be ticked through any task the caller happens to own.
    const ownerIds = isVirtual
      ? (await tenantDb().task.findMany({
        where: { parent_task_id: task.id, due_at: toUtcDate(dateStr) },
        select: { id: true },
      })).map((t: { id: string }) => t.id)
      : [task.id];

    const step = ownerIds.length
      ? await prismaBase().taskStep.findFirst({
        where: { id: stepId, task_id: { in: ownerIds } },
      })
      : null;
    if (!step) throw new HttpError(404, 'Step not found');

    const updated = await prismaBase().taskStep.update({
      where: { id: stepId },
      data: {
        status: done ? 'completed' : 'pending',
        completed_at: done ? new Date() : null,
      },
    });
    await invalidateCompletions();

    return {
      id: updated.id,
      title: updated.title,
      detail: updated.description ?? null,
      duration_seconds: updated.estimated_seconds ?? 0,
      status: updated.status === 'completed' ? 'COMPLETE' : 'PENDING',
    };
  },

  /**
   * DELETE /tasks/:occ/steps — remove every microstep from this occurrence.
   *
   * Turning the breakdown toggle off in the editor has to actually take the
   * steps away. Leaving them would mean the switch reads "off" while the plan
   * still shows microtasks, and the next save would append a second set on top.
   */
  async clearSteps(occId: string) {
    const { task, dateStr, isVirtual } = await resolveOccurrence(occId);

    // A repeating occurrence owns no row until a breakdown materialises one, so
    // its steps hang off that child rather than off the series.
    //
    // Both branches derive from tenantDb() lookups, which is what establishes
    // ownership: task_steps has no user_id of its own, so deleting by task id
    // is only safe because that id was resolved through the tenant client.
    const targetIds = isVirtual
      ? (await tenantDb().task.findMany({
        where: { parent_task_id: task.id, due_at: toUtcDate(dateStr) },
        select: { id: true },
      })).map((t: { id: string }) => t.id)
      : [task.id];

    if (targetIds.length === 0) return { deleted: 0 };

    const { count } = await prismaBase().taskStep.deleteMany({
      where: { task_id: { in: targetIds } },
    });
    if (count > 0) await invalidateCompletions();
    return { deleted: count };
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
