// Ada agent — tool registry over the existing feature services.
//
// Nothing here re-implements business logic: every tool is a thin, validated
// adapter onto the same service methods the REST routers call, so Ada's writes
// go through identical validation, revision bumps and cache invalidation as a
// user tapping the UI. That also means tenancy is inherited — the services use
// tenantDb(), which stamps/filters user_id from RequestContext.
//
// Ownership is re-checked in `parse` (not just at execution) for two reasons:
// the agent gets a correctable error mid-turn, and an approval granted minutes
// ago is re-validated against current state before it runs.

import { tenantDb } from '../../_shared/prisma.ts';
import { tasksService } from '../services/tasks.service.ts';
import { subjectsService } from '../services/subjects.service.ts';
import { semestersService } from '../services/semesters.service.ts';
import { tagsService } from '../services/tags.service.ts';
import { moodService } from '../services/mood.service.ts';
import { profileService } from '../services/profile.service.ts';
import { settingsService } from '../services/settings.service.ts';
import { streaksService } from '../services/streaks.service.ts';
import { type ActionPreview, type AgentTool, ToolInputError } from './types.ts';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-fA-F]{6}$/;
const REPEAT_KINDS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'everyNDays', 'everyNWeeks', 'everyNMonths'];
const PART_OF_DAY = ['anytime', 'morning', 'afternoon', 'evening'];
const MAX_DURATION_MINUTES = 24 * 60;

type Raw = Record<string, unknown>;

// ---- input helpers (throw ToolInputError so the agent can self-correct) ----

function reqStr(i: Raw, f: string, max = 500): string {
  const v = i[f];
  if (typeof v !== 'string' || !v.trim()) throw new ToolInputError(`\`${f}\` is required and must be a non-empty string.`);
  if (v.length > max) throw new ToolInputError(`\`${f}\` must be at most ${max} characters.`);
  return v.trim();
}

function optStr(i: Raw, f: string, max = 500): string | undefined {
  const v = i[f];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new ToolInputError(`\`${f}\` must be a string.`);
  if (v.length > max) throw new ToolInputError(`\`${f}\` must be at most ${max} characters.`);
  return v.trim();
}

function optInt(i: Raw, f: string, min: number, max: number): number | undefined {
  const v = i[f];
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ToolInputError(`\`${f}\` must be a number.`);
  const r = Math.round(n);
  if (r < min || r > max) throw new ToolInputError(`\`${f}\` must be between ${min} and ${max}.`);
  return r;
}

function optBool(i: Raw, f: string): boolean | undefined {
  const v = i[f];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new ToolInputError(`\`${f}\` must be true or false.`);
  return v;
}

function reqYmd(i: Raw, f: string): string {
  const v = reqStr(i, f, 10);
  if (!YMD.test(v)) throw new ToolInputError(`\`${f}\` must be a date in YYYY-MM-DD form, got "${v}".`);
  return v;
}

function optYmd(i: Raw, f: string): string | undefined {
  const v = optStr(i, f, 10);
  if (v === undefined) return undefined;
  if (!YMD.test(v)) throw new ToolInputError(`\`${f}\` must be a date in YYYY-MM-DD form, got "${v}".`);
  return v;
}

function optHhmm(i: Raw, f: string): string | undefined {
  const v = optStr(i, f, 5);
  if (v === undefined) return undefined;
  if (!HHMM.test(v)) throw new ToolInputError(`\`${f}\` must be a 24-hour time like "14:30", got "${v}".`);
  return v;
}

function optEnum(i: Raw, f: string, allowed: readonly string[]): string | undefined {
  const v = optStr(i, f, 40);
  if (v === undefined) return undefined;
  if (!allowed.includes(v)) throw new ToolInputError(`\`${f}\` must be one of: ${allowed.join(', ')}.`);
  return v;
}

/** An occurrence id is either a task uuid or `<task-uuid>@<YYYY-MM-DD>`. */
function reqOccurrenceId(i: Raw, f: string): string {
  const v = reqStr(i, f, 60);
  const [id, date] = v.split('@');
  if (!UUID.test(id) || (date !== undefined && !YMD.test(date))) {
    throw new ToolInputError(
      `\`${f}\` must be a task id from list_tasks (a uuid, optionally "uuid@YYYY-MM-DD" for a repeating occurrence).`,
    );
  }
  return v;
}

// ---- ownership guards (the tenancy floor for every id the model supplies) ----

async function ownedSubject(id: string) {
  if (!UUID.test(id)) throw new ToolInputError(`\`subject_id\` must be a subject id from list_subjects, got "${id}".`);
  const row = await tenantDb().course.findFirst({ where: { id } });
  if (!row) throw new ToolInputError(`No subject with id ${id} belongs to this user.`, 'Call list_subjects and use an id from it.');
  return row;
}

async function ownedSemester(id: string) {
  if (!UUID.test(id)) throw new ToolInputError(`\`semester_id\` must be a semester id from list_semesters, got "${id}".`);
  const row = await tenantDb().academicTerm.findFirst({ where: { id } });
  if (!row) throw new ToolInputError(`No semester with id ${id} belongs to this user.`, 'Call list_semesters first.');
  return row;
}

async function ownedTask(occId: string) {
  const seriesId = occId.split('@')[0];
  const row = await tenantDb().task.findFirst({ where: { id: seriesId } });
  if (!row) throw new ToolInputError(`No task with id ${seriesId} belongs to this user.`, 'Call list_tasks and use an id from it.');
  return row;
}

/** Resolve a category the model gave us into a study-tag id when we can. */
async function resolveCategory(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;
  if (UUID.test(raw)) {
    const byId = await tenantDb().studyTag.findFirst({ where: { id: raw } });
    if (!byId) throw new ToolInputError(`No study tag with id ${raw} belongs to this user.`, 'Call list_study_tags first.');
    return byId.id;
  }
  const byName = await tenantDb().studyTag.findFirst({ where: { name: { equals: raw, mode: 'insensitive' } } });
  return byName?.id ?? raw;
}

async function tagLabel(id?: string): Promise<string | null> {
  if (!id) return null;
  if (!UUID.test(id)) return id;
  const t = await tenantDb().studyTag.findFirst({ where: { id } });
  return t?.name ?? id;
}

async function subjectName(id?: string | null): Promise<string | null> {
  if (!id) return null;
  const s = await tenantDb().course.findFirst({ where: { id } });
  return s?.name ?? null;
}

function minutesLabel(mins?: number): string | null {
  if (mins === undefined) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Only include fields that actually change; a card of "unchanged" rows is noise. */
function diff(fields: Array<{ label: string; from?: string | null; to?: string | null }>) {
  return fields.filter((f) => f.to !== undefined && f.to !== null && f.to !== f.from);
}

// =========================================================================
// READ TOOLS
// =========================================================================

const readTools: AgentTool[] = [
  {
    name: 'list_tasks',
    description:
      'List the user\'s tasks for a single date or an inclusive date range. Returns occurrence ids that other task tools accept. Always call this before updating, completing, moving or deleting a task.',
    kind: 'read',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Single day, YYYY-MM-DD.' },
        from: { type: 'string', description: 'Range start, YYYY-MM-DD. Use with `to`.' },
        to: { type: 'string', description: 'Range end (inclusive), YYYY-MM-DD.' },
      },
    },
    parse: (i) => Promise.resolve({ date: optYmd(i, 'date'), from: optYmd(i, 'from'), to: optYmd(i, 'to') }),
    run: (a) => tasksService.query(a),
  },
  {
    name: 'list_subjects',
    description: 'List the user\'s subjects (courses) with ids, colours, and attached files.',
    kind: 'read',
    resource: 'subject',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => subjectsService.list(),
  },
  {
    name: 'list_semesters',
    description: 'List the user\'s semesters / academic terms, including which one is active.',
    kind: 'read',
    resource: 'semester',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => semestersService.list(),
  },
  {
    name: 'list_study_tags',
    description: 'List the user\'s study tags. A tag id is what a task\'s `category` should be set to.',
    kind: 'read',
    resource: 'study_tag',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => tagsService.list(),
  },
  {
    name: 'get_streak',
    description: 'Get the user\'s current and longest activity streak.',
    kind: 'read',
    resource: 'streak',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => streaksService.current(),
  },
  {
    name: 'get_mood_week',
    description: 'Get the user\'s mood check-ins for the week containing the given date (defaults to this week).',
    kind: 'read',
    resource: 'mood',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Any date in the week, YYYY-MM-DD.' } },
    },
    parse: (i) => Promise.resolve({ date: optYmd(i, 'date') }),
    run: (a) => moodService.week(a.date),
  },
  {
    name: 'get_profile',
    description: 'Get the user\'s profile (name, university, program, guest status).',
    kind: 'read',
    resource: 'profile',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => profileService.get(),
  },
  {
    name: 'get_settings',
    description: 'Get the user\'s app settings (theme, daily focus goal, notification times).',
    kind: 'read',
    resource: 'settings',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => settingsService.getSettings(),
  },
  {
    name: 'get_study_stats',
    description: 'Get aggregate study statistics: focus minutes, tasks completed, subject breakdown.',
    kind: 'read',
    resource: 'stats',
    input_schema: { type: 'object', properties: {} },
    parse: () => Promise.resolve({}),
    run: () => profileService.stats(),
  },
];

// =========================================================================
// WRITE TOOLS — proposed only; executed after the user approves.
// =========================================================================

const writeTools: AgentTool[] = [
  // ---- tasks ----
  {
    name: 'create_task',
    description:
      'Propose creating one task. For several tasks call this once per task. Set `repeat` only for genuinely recurring work.',
    kind: 'write',
    operation: 'create',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the user will do. Specific and short.' },
        date: { type: 'string', description: 'The day it is scheduled for, YYYY-MM-DD. Must not be in the past.' },
        subject_id: { type: 'string', description: 'Subject id from list_subjects. Defaults to the user\'s first subject.' },
        duration_minutes: { type: 'integer', description: 'Estimated minutes, 5–1440.' },
        scheduled_at: { type: 'string', description: 'Optional clock start time, 24-hour "HH:MM".' },
        part_of_day: { type: 'string', description: 'anytime | morning | afternoon | evening. Use when there is no exact time.' },
        category: { type: 'string', description: 'Study-tag id from list_study_tags.' },
        note: { type: 'string', description: 'Optional longer detail.' },
        repeat: {
          type: 'object',
          description: 'Recurrence. Omit for one-off tasks.',
          properties: {
            kind: { type: 'string', description: REPEAT_KINDS.join(' | ') },
            interval: { type: 'integer', description: 'Every N units, for the everyN* kinds.' },
          },
        },
        until_date: { type: 'string', description: 'Last date a recurrence applies, YYYY-MM-DD.' },
      },
      required: ['title', 'date'],
    },
    async parse(i) {
      const title = reqStr(i, 'title', 300);
      const date = reqYmd(i, 'date');
      const subjectId = optStr(i, 'subject_id', 60);
      if (subjectId) await ownedSubject(subjectId);

      const repeatRaw = i.repeat as Raw | undefined;
      let repeat: { kind: string; interval?: number } | undefined;
      if (repeatRaw && typeof repeatRaw === 'object') {
        const kind = optStr(repeatRaw, 'kind', 30);
        if (kind && kind !== 'none') {
          if (!REPEAT_KINDS.includes(kind)) {
            throw new ToolInputError(`\`repeat.kind\` must be one of: ${REPEAT_KINDS.join(', ')}.`);
          }
          repeat = { kind, interval: optInt(repeatRaw, 'interval', 1, 52) };
        }
      }

      return {
        title,
        date,
        subject_id: subjectId,
        duration_minutes: optInt(i, 'duration_minutes', 5, MAX_DURATION_MINUTES),
        scheduled_at: optHhmm(i, 'scheduled_at'),
        part_of_day: optEnum(i, 'part_of_day', PART_OF_DAY),
        category: await resolveCategory(optStr(i, 'category', 60)),
        note: optStr(i, 'note', 2000),
        repeat,
        until_date: optYmd(i, 'until_date'),
      };
    },
    async preview(a): Promise<ActionPreview> {
      const subject = await subjectName(a.subject_id);
      return {
        title: `Add task “${a.title}”`,
        fields: diff([
          { label: 'Date', to: a.date },
          { label: 'Time', to: a.scheduled_at ?? (a.part_of_day && a.part_of_day !== 'anytime' ? a.part_of_day : null) },
          { label: 'Subject', to: subject },
          { label: 'Duration', to: minutesLabel(a.duration_minutes) },
          { label: 'Tag', to: await tagLabel(a.category) },
          { label: 'Repeats', to: a.repeat ? `${a.repeat.kind}${a.repeat.interval && a.repeat.interval > 1 ? ` ×${a.repeat.interval}` : ''}` : null },
          { label: 'Note', to: a.note },
        ]),
      };
    },
    execute: (a) =>
      tasksService.create({
        title: a.title,
        date: a.date,
        subject_id: a.subject_id,
        duration_seconds: a.duration_minutes ? a.duration_minutes * 60 : undefined,
        // The app stores wall-clock-as-UTC; match it so Ada's tasks render
        // identically to ones created in the UI.
        scheduled_at: a.scheduled_at ? `${a.date}T${a.scheduled_at}:00.000Z` : undefined,
        part_of_day: a.part_of_day,
        category: a.category,
        note: a.note,
        repeat: a.repeat,
        until_date: a.until_date,
      }),
  },
  {
    name: 'update_task',
    description:
      'Propose editing an existing task. To change which day a task falls on use move_tasks instead. To tick it off use complete_task.',
    kind: 'write',
    operation: 'update',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Occurrence id from list_tasks.' },
        title: { type: 'string' },
        duration_minutes: { type: 'integer', description: '5–1440.' },
        scheduled_at: { type: 'string', description: 'Clock start time "HH:MM", or "" to clear it.' },
        part_of_day: { type: 'string', description: 'anytime | morning | afternoon | evening.' },
        category: { type: 'string', description: 'Study-tag id.' },
        note: { type: 'string' },
      },
      required: ['task_id'],
    },
    async parse(i) {
      const taskId = reqOccurrenceId(i, 'task_id');
      await ownedTask(taskId);
      const args = {
        task_id: taskId,
        title: optStr(i, 'title', 300),
        duration_minutes: optInt(i, 'duration_minutes', 5, MAX_DURATION_MINUTES),
        // '' is meaningful here (clear the time), so it is read before optHhmm.
        scheduled_at: i.scheduled_at === '' ? '' : optHhmm(i, 'scheduled_at'),
        part_of_day: optEnum(i, 'part_of_day', PART_OF_DAY),
        category: await resolveCategory(optStr(i, 'category', 60)),
        note: optStr(i, 'note', 2000),
      };
      const touched = Object.entries(args).filter(([k, v]) => k !== 'task_id' && v !== undefined);
      if (touched.length === 0) {
        throw new ToolInputError('update_task needs at least one field to change besides `task_id`.');
      }
      return args;
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedTask(a.task_id);
      const beforeMins = before.estimated_duration_mins ?? undefined;
      return {
        title: `Edit task “${before.title}”`,
        fields: diff([
          { label: 'Title', from: before.title, to: a.title },
          { label: 'Duration', from: minutesLabel(beforeMins ?? undefined), to: minutesLabel(a.duration_minutes) },
          {
            label: 'Time',
            from: before.scheduled_start_at ? new Date(before.scheduled_start_at).toISOString().slice(11, 16) : null,
            to: a.scheduled_at === '' ? 'cleared' : a.scheduled_at,
          },
          { label: 'Part of day', from: before.planner_section ?? null, to: a.part_of_day },
          { label: 'Tag', from: await tagLabel(before.task_type ?? undefined), to: await tagLabel(a.category) },
          { label: 'Note', from: before.description ?? null, to: a.note },
        ]),
      };
    },
    async execute(a) {
      const date = a.task_id.includes('@') ? a.task_id.split('@')[1] : undefined;
      return await tasksService.patch(a.task_id, {
        title: a.title,
        duration_seconds: a.duration_minutes ? a.duration_minutes * 60 : undefined,
        scheduled_at: a.scheduled_at === ''
          ? ''
          : a.scheduled_at
          ? `${date ?? (await ownedTaskDate(a.task_id))}T${a.scheduled_at}:00.000Z`
          : undefined,
        part_of_day: a.part_of_day,
        category: a.category,
        note: a.note,
      });
    },
  },
  {
    name: 'complete_task',
    description: 'Propose marking a task done (or un-done).',
    kind: 'write',
    operation: 'update',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Occurrence id from list_tasks.' },
        done: { type: 'boolean', description: 'true to complete, false to reopen. Defaults to true.' },
      },
      required: ['task_id'],
    },
    async parse(i) {
      const taskId = reqOccurrenceId(i, 'task_id');
      await ownedTask(taskId);
      return { task_id: taskId, done: optBool(i, 'done') ?? true };
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedTask(a.task_id);
      return {
        title: a.done ? `Mark “${before.title}” done` : `Reopen “${before.title}”`,
        fields: [{ label: 'Status', from: before.status === 'completed' ? 'done' : 'open', to: a.done ? 'done' : 'open' }],
      };
    },
    execute: (a) => tasksService.setDone(a.task_id, a.done),
  },
  {
    name: 'move_tasks',
    description:
      'Propose moving tasks from one day to another. Omit `task_ids` to move every task on that day. This is how a task changes date.',
    kind: 'write',
    operation: 'update',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source day, YYYY-MM-DD.' },
        to: { type: 'string', description: 'Destination day, YYYY-MM-DD.' },
        task_ids: {
          type: 'array',
          description: 'Occurrence ids to move. Omit to move the whole day.',
          items: { type: 'string' },
        },
      },
      required: ['from', 'to'],
    },
    async parse(i) {
      const from = reqYmd(i, 'from');
      const to = reqYmd(i, 'to');
      if (from === to) throw new ToolInputError('`from` and `to` are the same day — nothing to move.');
      const rawIds = i.task_ids;
      let ids: string[] | undefined;
      if (rawIds !== undefined && rawIds !== null) {
        if (!Array.isArray(rawIds)) throw new ToolInputError('`task_ids` must be an array of task ids.');
        ids = [];
        for (const raw of rawIds) {
          const id = reqOccurrenceId({ id: raw }, 'id');
          await ownedTask(id);
          ids.push(id);
        }
        if (ids.length === 0) ids = undefined;
      }
      return { from, to, task_ids: ids };
    },
    async preview(a): Promise<ActionPreview> {
      const count = a.task_ids?.length ?? (await tasksService.query({ date: a.from })).tasks.length;
      return {
        title: a.task_ids
          ? `Move ${count} task${count === 1 ? '' : 's'} to ${a.to}`
          : `Move everything on ${a.from} to ${a.to}`,
        fields: [
          { label: 'From', to: a.from },
          { label: 'To', to: a.to },
          { label: 'Tasks', to: String(count) },
        ],
        warning: a.task_ids ? undefined : `This moves all ${count} task(s) scheduled on ${a.from}.`,
      };
    },
    execute: (a) => tasksService.move({ from: a.from, to: a.to, ids: a.task_ids }),
  },
  {
    name: 'delete_task',
    description: 'Propose deleting a task. For a repeating task this cancels the single occurrence you name.',
    kind: 'write',
    operation: 'delete',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'Occurrence id from list_tasks.' } },
      required: ['task_id'],
    },
    async parse(i) {
      const taskId = reqOccurrenceId(i, 'task_id');
      await ownedTask(taskId);
      return { task_id: taskId };
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedTask(a.task_id);
      return {
        title: `Delete task “${before.title}”`,
        fields: [{ label: 'Task', to: before.title }],
        warning: a.task_id.includes('@')
          ? 'Only this occurrence of the repeating task is removed.'
          : 'This cannot be undone.',
      };
    },
    execute: (a) => tasksService.remove(a.task_id),
  },
  {
    name: 'breakdown_task',
    description: 'Propose splitting a task into ordered microsteps.',
    kind: 'write',
    operation: 'update',
    resource: 'task',
    input_schema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'Occurrence id from list_tasks.' } },
      required: ['task_id'],
    },
    async parse(i) {
      const taskId = reqOccurrenceId(i, 'task_id');
      await ownedTask(taskId);
      return { task_id: taskId };
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedTask(a.task_id);
      return { title: `Break “${before.title}” into steps`, fields: [{ label: 'Task', to: before.title }] };
    },
    execute: (a) => tasksService.breakdown(a.task_id, {}),
  },

  // ---- subjects ----
  {
    name: 'create_subject',
    description: 'Propose creating a subject (course).',
    kind: 'write',
    operation: 'create',
    resource: 'subject',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        color_hex: { type: 'string', description: 'Hex colour like "#6B5CF0".' },
        code: { type: 'string', description: 'Course code, e.g. "CS F211".' },
        credits: { type: 'integer', description: '0–30.' },
        prof: { type: 'string', description: 'Professor name.' },
        target_grade: { type: 'string' },
        semester_id: { type: 'string', description: 'Defaults to the active semester.' },
      },
      required: ['name'],
    },
    async parse(i) {
      const semesterId = optStr(i, 'semester_id', 60);
      if (semesterId) await ownedSemester(semesterId);
      const color = optStr(i, 'color_hex', 7);
      if (color && !HEX.test(color)) throw new ToolInputError('`color_hex` must look like "#6B5CF0".');
      return {
        name: reqStr(i, 'name', 120),
        color_hex: color ?? '#6B5CF0',
        code: optStr(i, 'code', 40),
        credits: optInt(i, 'credits', 0, 30),
        prof: optStr(i, 'prof', 120),
        target_grade: optStr(i, 'target_grade', 20),
        semester_id: semesterId,
      };
    },
    preview: (a) =>
      Promise.resolve({
        title: `Add subject “${a.name}”`,
        fields: diff([
          { label: 'Code', to: a.code },
          { label: 'Professor', to: a.prof },
          { label: 'Credits', to: a.credits !== undefined ? String(a.credits) : null },
          { label: 'Target grade', to: a.target_grade },
          { label: 'Colour', to: a.color_hex },
        ]),
      }),
    execute: (a) => subjectsService.create(a),
  },
  {
    name: 'update_subject',
    description: 'Propose editing a subject.',
    kind: 'write',
    operation: 'update',
    resource: 'subject',
    input_schema: {
      type: 'object',
      properties: {
        subject_id: { type: 'string' },
        name: { type: 'string' },
        color_hex: { type: 'string' },
        code: { type: 'string' },
        credits: { type: 'integer' },
        prof: { type: 'string' },
        target_grade: { type: 'string' },
      },
      required: ['subject_id'],
    },
    async parse(i) {
      const id = reqStr(i, 'subject_id', 60);
      await ownedSubject(id);
      const color = optStr(i, 'color_hex', 7);
      if (color && !HEX.test(color)) throw new ToolInputError('`color_hex` must look like "#6B5CF0".');
      const args = {
        subject_id: id,
        name: optStr(i, 'name', 120),
        color_hex: color,
        code: optStr(i, 'code', 40),
        credits: optInt(i, 'credits', 0, 30),
        prof: optStr(i, 'prof', 120),
        target_grade: optStr(i, 'target_grade', 20),
      };
      if (Object.entries(args).filter(([k, v]) => k !== 'subject_id' && v !== undefined).length === 0) {
        throw new ToolInputError('update_subject needs at least one field to change besides `subject_id`.');
      }
      return args;
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedSubject(a.subject_id);
      return {
        title: `Edit subject “${before.name}”`,
        fields: diff([
          { label: 'Name', from: before.name, to: a.name },
          { label: 'Code', from: before.code ?? null, to: a.code },
          { label: 'Professor', from: before.professor ?? null, to: a.prof },
          { label: 'Credits', from: before.credits != null ? String(before.credits) : null, to: a.credits !== undefined ? String(a.credits) : null },
          { label: 'Target grade', from: before.target_grade_text ?? null, to: a.target_grade },
          { label: 'Colour', from: before.color ?? null, to: a.color_hex },
        ]),
      };
    },
    execute: (a) => {
      const { subject_id, ...rest } = a;
      return subjectsService.update(subject_id, rest);
    },
  },
  {
    name: 'delete_subject',
    description: 'Propose deleting a subject. Its tasks and files go with it.',
    kind: 'write',
    operation: 'delete',
    resource: 'subject',
    input_schema: {
      type: 'object',
      properties: { subject_id: { type: 'string' } },
      required: ['subject_id'],
    },
    async parse(i) {
      const id = reqStr(i, 'subject_id', 60);
      await ownedSubject(id);
      return { subject_id: id };
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedSubject(a.subject_id);
      const taskCount = await tenantDb().task.count({ where: { course_id: a.subject_id } });
      return {
        title: `Delete subject “${before.name}”`,
        fields: [{ label: 'Subject', to: before.name }, { label: 'Tasks affected', to: String(taskCount) }],
        warning: taskCount > 0
          ? `${taskCount} task(s) belong to this subject and will be removed with it. This cannot be undone.`
          : 'This cannot be undone.',
      };
    },
    execute: (a) => subjectsService.remove(a.subject_id),
  },

  // ---- semesters ----
  {
    name: 'create_semester',
    description: 'Propose creating a semester / academic term.',
    kind: 'write',
    operation: 'create',
    resource: 'semester',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        start: { type: 'string', description: 'YYYY-MM-DD.' },
        end: { type: 'string', description: 'YYYY-MM-DD, after `start`.' },
      },
      required: ['name', 'start', 'end'],
    },
    parse(i) {
      const start = reqYmd(i, 'start');
      const end = reqYmd(i, 'end');
      if (end <= start) throw new ToolInputError('`end` must be after `start`.');
      return Promise.resolve({ name: reqStr(i, 'name', 120), start, end });
    },
    preview: (a) =>
      Promise.resolve({
        title: `Add semester “${a.name}”`,
        fields: [{ label: 'Starts', to: a.start }, { label: 'Ends', to: a.end }],
      }),
    execute: (a) => semestersService.create(a),
  },
  {
    name: 'update_semester',
    description: 'Propose editing a semester\'s name or dates.',
    kind: 'write',
    operation: 'update',
    resource: 'semester',
    input_schema: {
      type: 'object',
      properties: {
        semester_id: { type: 'string' },
        name: { type: 'string' },
        start: { type: 'string', description: 'YYYY-MM-DD.' },
        end: { type: 'string', description: 'YYYY-MM-DD.' },
      },
      required: ['semester_id'],
    },
    async parse(i) {
      const id = reqStr(i, 'semester_id', 60);
      await ownedSemester(id);
      const args = { semester_id: id, name: optStr(i, 'name', 120), start: optYmd(i, 'start'), end: optYmd(i, 'end') };
      if (args.start && args.end && args.end <= args.start) throw new ToolInputError('`end` must be after `start`.');
      if (!args.name && !args.start && !args.end) {
        throw new ToolInputError('update_semester needs a name, start or end to change.');
      }
      return args;
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedSemester(a.semester_id);
      const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
      return {
        title: `Edit semester “${before.name}”`,
        fields: diff([
          { label: 'Name', from: before.name, to: a.name },
          { label: 'Starts', from: iso(before.start_date), to: a.start },
          { label: 'Ends', from: iso(before.end_date), to: a.end },
        ]),
      };
    },
    execute: (a) => {
      const { semester_id, ...rest } = a;
      return semestersService.update(semester_id, rest);
    },
  },
  {
    name: 'delete_semester',
    description: 'Propose deleting a semester. Not allowed if it is the only one.',
    kind: 'write',
    operation: 'delete',
    resource: 'semester',
    input_schema: {
      type: 'object',
      properties: { semester_id: { type: 'string' } },
      required: ['semester_id'],
    },
    async parse(i) {
      const id = reqStr(i, 'semester_id', 60);
      await ownedSemester(id);
      return { semester_id: id };
    },
    async preview(a): Promise<ActionPreview> {
      const before = await ownedSemester(a.semester_id);
      const subjectCount = await tenantDb().course.count({ where: { term_id: a.semester_id } });
      return {
        title: `Delete semester “${before.name}”`,
        fields: [{ label: 'Subjects in it', to: String(subjectCount) }],
        warning: 'This cannot be undone.',
      };
    },
    execute: (a) => semestersService.remove(a.semester_id),
  },

  // ---- study tags ----
  {
    name: 'create_study_tag',
    description: 'Propose creating a study tag (used to categorise and colour tasks).',
    kind: 'write',
    operation: 'create',
    resource: 'study_tag',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        color: { type: 'string', description: 'Hex colour like "#34C759".' },
      },
      required: ['label'],
    },
    parse(i) {
      const color = optStr(i, 'color', 7);
      if (color && !HEX.test(color)) throw new ToolInputError('`color` must look like "#34C759".');
      return Promise.resolve({ label: reqStr(i, 'label', 60), color });
    },
    preview: (a) =>
      Promise.resolve({
        title: `Add study tag “${a.label}”`,
        fields: diff([{ label: 'Colour', to: a.color }]),
      }),
    execute: (a) => tagsService.create(a),
  },
  {
    name: 'delete_study_tag',
    description: 'Propose deleting a study tag by its label.',
    kind: 'write',
    operation: 'delete',
    resource: 'study_tag',
    input_schema: {
      type: 'object',
      properties: { label: { type: 'string' } },
      required: ['label'],
    },
    async parse(i) {
      const label = reqStr(i, 'label', 60);
      const found = await tenantDb().studyTag.findFirst({ where: { name: { equals: label, mode: 'insensitive' } } });
      if (!found) throw new ToolInputError(`No study tag called "${label}".`, 'Call list_study_tags first.');
      return { label: found.name };
    },
    preview: (a) =>
      Promise.resolve({
        title: `Delete study tag “${a.label}”`,
        warning: 'Tasks already using this tag keep their label but lose its colour.',
      }),
    execute: (a) => tagsService.remove(a.label),
  },

  // ---- mood ----
  {
    name: 'log_mood',
    description: 'Propose recording the user\'s mood check-in for a day.',
    kind: 'write',
    operation: 'create',
    resource: 'mood',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD.' },
        mood_index: { type: 'integer', description: '0 (worst) to 4 (best).' },
        intention: { type: 'string', description: 'Optional intention for the day.' },
      },
      required: ['date', 'mood_index'],
    },
    parse(i) {
      const moodIndex = optInt(i, 'mood_index', 0, 4);
      if (moodIndex === undefined) throw new ToolInputError('`mood_index` is required (0–4).');
      return Promise.resolve({ date: reqYmd(i, 'date'), mood_index: moodIndex, intention: optStr(i, 'intention', 500) });
    },
    preview: (a) =>
      Promise.resolve({
        title: `Log mood for ${a.date}`,
        fields: diff([
          { label: 'Mood', to: `${a.mood_index + 1}/5` },
          { label: 'Intention', to: a.intention },
        ]),
      }),
    execute: (a) => moodService.log(a),
  },

  // ---- profile & settings ----
  {
    name: 'update_profile',
    description: 'Propose updating the user\'s profile details.',
    kind: 'write',
    operation: 'update',
    resource: 'profile',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        university: { type: 'string' },
        program: { type: 'string' },
        gender: { type: 'string' },
        date_of_birth: { type: 'string', description: 'YYYY-MM-DD.' },
      },
    },
    parse(i) {
      const args = {
        name: optStr(i, 'name', 120),
        university: optStr(i, 'university', 160),
        program: optStr(i, 'program', 160),
        gender: optStr(i, 'gender', 40),
        date_of_birth: optYmd(i, 'date_of_birth'),
      };
      if (Object.values(args).every((v) => v === undefined)) {
        throw new ToolInputError('update_profile needs at least one field to change.');
      }
      return Promise.resolve(args);
    },
    async preview(a): Promise<ActionPreview> {
      const before = await profileService.get();
      return {
        title: 'Update your profile',
        fields: diff([
          { label: 'Name', from: before.name, to: a.name },
          { label: 'University', from: before.university, to: a.university },
          { label: 'Program', from: before.program, to: a.program },
          { label: 'Gender', from: before.gender, to: a.gender },
          { label: 'Date of birth', from: before.date_of_birth, to: a.date_of_birth },
        ]),
      };
    },
    execute: (a) => profileService.update(a),
  },
  {
    name: 'update_settings',
    description: 'Propose updating app settings (theme, daily focus goal, notification times).',
    kind: 'write',
    operation: 'update',
    resource: 'settings',
    input_schema: {
      type: 'object',
      properties: {
        theme_mode: { type: 'string', description: 'light | dark | system.' },
        daily_focus_goal_min: { type: 'integer', description: 'Daily focus goal in minutes, 5–960.' },
        notification_time: { type: 'string', description: 'Reminder time "HH:MM".' },
        notification_time_morning: { type: 'string', description: 'Morning check-in time "HH:MM".' },
        notification_time_review: { type: 'string', description: 'Evening review time "HH:MM".' },
      },
    },
    parse(i) {
      const args = {
        theme_mode: optEnum(i, 'theme_mode', ['light', 'dark', 'system']),
        daily_focus_goal_min: optInt(i, 'daily_focus_goal_min', 5, 960),
        notification_time: optHhmm(i, 'notification_time'),
        notification_time_morning: optHhmm(i, 'notification_time_morning'),
        notification_time_review: optHhmm(i, 'notification_time_review'),
      };
      if (Object.values(args).every((v) => v === undefined)) {
        throw new ToolInputError('update_settings needs at least one setting to change.');
      }
      return Promise.resolve(args);
    },
    async preview(a): Promise<ActionPreview> {
      // deno-lint-ignore no-explicit-any
      const before = await settingsService.getSettings() as any;
      return {
        title: 'Update your settings',
        fields: diff([
          { label: 'Theme', from: before.theme_mode ?? null, to: a.theme_mode },
          {
            label: 'Daily focus goal',
            from: minutesLabel(before.daily_focus_goal_min ?? undefined),
            to: minutesLabel(a.daily_focus_goal_min),
          },
          { label: 'Reminder time', from: before.notification_time ?? null, to: a.notification_time },
          { label: 'Morning check-in', from: before.notification_time_morning ?? null, to: a.notification_time_morning },
          { label: 'Evening review', from: before.notification_time_review ?? null, to: a.notification_time_review },
        ]),
      };
    },
    execute: (a) => settingsService.patchSettings(a),
  },
];

/** The date a bare (non-`@date`) occurrence id falls on, for time composition. */
async function ownedTaskDate(occId: string): Promise<string> {
  const row = await ownedTask(occId);
  return row.due_at ? new Date(row.due_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export const ALL_TOOLS: AgentTool[] = [...readTools, ...writeTools];

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name);
}

/** Provider-facing declarations (Anthropic Messages shape; adapted for Gemini upstream). */
export function toolDefs() {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
