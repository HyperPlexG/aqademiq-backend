// §2.12 — calendar & reminder import: every decision that is made in code
// rather than by the database. PURE (no Prisma, no Redis) so it can be unit
// tested directly — see import_plan_test.ts. The service that does the IO is
// calendar-import.service.ts.
//
// The phone reads the student's calendars and reminders itself (EventKit on
// iOS, CalendarContract on Android, or an .ics file / link / pasted list parsed
// on the device), shows them for review, and sends only the picked items here.
// Each one becomes an ordinary one-off task on its day, at its time.
//
// Why imports are tracked on the task row and NOT in calendar_events:
// agent/schedule.ts `busyBlocks()` treats every calendar_events row as a busy
// slot, and it already reads tasks. An imported lecture stored in both places
// would be counted twice, and Ada would see half the free time the student
// actually has. So an import is just a task with `source = 'calendar_import'` and
// `metadata.import_key = "<source>:<external_id>"`, which is also what makes a
// second import of the same calendar skip what is already there.

import { HttpError } from '../../_shared/http.ts';

export const IMPORT_SOURCES = ['device_calendar', 'device_reminders', 'ics', 'text'] as const;
export type ImportSource = typeof IMPORT_SOURCES[number];

/** Items per POST /integrations/import. The app sends larger imports in chunks. */
export const MAX_IMPORT_ITEMS = 200;
/** External ids per POST /integrations/import/check. */
export const MAX_CHECK_IDS = 1000;
/** Keeps `<source>:<external_id>` comfortably short for a JSON text lookup. */
export const MAX_EXTERNAL_ID = 400;
/** tasks.title is VARCHAR(255). Longer titles are cut rather than rejected. */
export const MAX_TITLE = 255;
export const MAX_NOTE = 4000;
/** Mirrors REMINDER_LEAD_MS in tasks.service.ts (and `reminderLead` in the app). */
export const REMINDER_LEAD_MS = 10 * 60 * 1000;
/** Mirrors the default in tasksService.create when no duration is sent. */
export const DEFAULT_DURATION_MINS = 5;
/** A day. Anything longer is an all-day event and arrives without a time. */
export const MAX_DURATION_MINS = 24 * 60;
/**
 * The task_type an import gets when the student picks no tag. The Plan shows
 * `general` as "Untagged" (tag_resolve.dart) — the honest label. The tasks
 * endpoint's own default, `assignment`, would file every lecture and dentist
 * appointment as an assignment.
 */
export const UNTAGGED_CATEGORY = 'general';

/**
 * `tasks.source` for every imported task — calendar events, reminders and
 * pasted lines alike (`metadata.import_source` says which).
 *
 * The live database constrains this column: `tasks_source_check` allows only
 * manual | ada | calendar_import | material_import. That constraint is not in
 * supabase/migrations/ or prisma/schema.prisma, so nothing in the repo shows
 * it — but any other value fails the whole insert. Do not invent a new one
 * without a migration that widens the check.
 */
export const IMPORTED_TASK_SOURCE = 'calendar_import';

const PARTS_OF_DAY = ['anytime', 'morning', 'afternoon', 'evening'] as const;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ImportItem {
  /** Stable id from the source (event + occurrence start, reminder id, …). */
  external_id: string;
  title: string;
  /** The day the task lands on, YYYY-MM-DD, in the student's own calendar. */
  date: string;
  /** Wall-clock start, HH:mm — null for all-day events and undated reminders. */
  start_time: string | null;
  duration_seconds: number | null;
  part_of_day: string;
  note: string | null;
}

export interface ImportRequest {
  source: ImportSource;
  /** Study-tag id or label for every item in the batch; null = untagged. */
  category: string | null;
  items: ImportItem[];
}

export interface CheckRequest {
  source: ImportSource;
  external_ids: string[];
}

/** One already-imported task, as read back by the service. */
export interface ExistingImportRow {
  id: string;
  status: string;
  import_key: string;
}

export interface ImportPlan {
  /** Items that become new tasks. */
  create: ImportItem[];
  /** Items already in the plan as a live task — left alone. */
  existing: Array<{ item: ImportItem; task_id: string }>;
  /** Repeats of an earlier item in the same request. */
  duplicates: number;
}

export function importKey(source: ImportSource, externalId: string): string {
  return `${source}:${externalId}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Collapse runs of whitespace and cut to [max] characters. */
function squash(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max).trimEnd() : one;
}

function realDate(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseSource(b: Record<string, unknown>): ImportSource {
  const raw = b['source'];
  if (typeof raw !== 'string' || !(IMPORT_SOURCES as readonly string[]).includes(raw)) {
    throw new HttpError(422, `source must be one of ${IMPORT_SOURCES.join(', ')}`);
  }
  return raw as ImportSource;
}

function parseExternalId(raw: unknown, where: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new HttpError(422, `${where}.external_id is required`);
  }
  const id = raw.trim();
  if (id.length > MAX_EXTERNAL_ID) throw new HttpError(422, `${where}.external_id is too long`);
  return id;
}

/** Validate one item. Throws HttpError(422) naming the offending field. */
export function parseImportItem(raw: unknown, index: number): ImportItem {
  const where = `items[${index}]`;
  if (!isRecord(raw)) throw new HttpError(422, `${where} must be an object`);

  const external_id = parseExternalId(raw['external_id'], where);

  // Same rule as cleanTitle(): a task has to be called something.
  const rawTitle = raw['title'];
  if (typeof rawTitle !== 'string') throw new HttpError(422, `${where}.title is required`);
  const title = squash(rawTitle, MAX_TITLE);
  if (!title) throw new HttpError(422, `${where}.title cannot be empty`);

  const date = raw['date'];
  if (typeof date !== 'string' || !YMD.test(date) || !realDate(date)) {
    throw new HttpError(422, `${where}.date must be YYYY-MM-DD`);
  }

  let start_time: string | null = null;
  const rawStart = raw['start_time'];
  if (rawStart !== undefined && rawStart !== null) {
    if (typeof rawStart !== 'string' || !HHMM.test(rawStart)) {
      throw new HttpError(422, `${where}.start_time must be HH:mm`);
    }
    start_time = rawStart;
  }

  let duration_seconds: number | null = null;
  const rawDuration = raw['duration_seconds'];
  if (rawDuration !== undefined && rawDuration !== null) {
    if (typeof rawDuration !== 'number' || !Number.isInteger(rawDuration) || rawDuration < 0) {
      throw new HttpError(422, `${where}.duration_seconds must be a whole number of seconds`);
    }
    duration_seconds = rawDuration;
  }

  let part_of_day = 'anytime';
  const rawPart = raw['part_of_day'];
  if (rawPart !== undefined && rawPart !== null) {
    if (typeof rawPart !== 'string' || !(PARTS_OF_DAY as readonly string[]).includes(rawPart)) {
      throw new HttpError(422, `${where}.part_of_day must be one of ${PARTS_OF_DAY.join(', ')}`);
    }
    part_of_day = rawPart;
  }

  let note: string | null = null;
  const rawNote = raw['note'];
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== 'string') throw new HttpError(422, `${where}.note must be a string`);
    // Newlines are kept: a lecture's notes are often a few lines long.
    const trimmed = rawNote.trim();
    note = trimmed ? trimmed.slice(0, MAX_NOTE) : null;
  }

  return { external_id, title, date, start_time, duration_seconds, part_of_day, note };
}

/** Body of POST /integrations/import. */
export function parseImportRequest(b: Record<string, unknown>): ImportRequest {
  const source = parseSource(b);

  let category: string | null = null;
  const rawCategory = b['category'];
  if (rawCategory !== undefined && rawCategory !== null) {
    if (typeof rawCategory !== 'string') throw new HttpError(422, 'category must be a string');
    category = rawCategory.trim().slice(0, 50) || null;
  }

  const rawItems = b['items'];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(422, 'items must be a non-empty array');
  }
  if (rawItems.length > MAX_IMPORT_ITEMS) {
    throw new HttpError(422, `items may hold at most ${MAX_IMPORT_ITEMS} entries per request`);
  }
  return { source, category, items: rawItems.map((it, i) => parseImportItem(it, i)) };
}

/** Body of POST /integrations/import/check. */
export function parseCheckRequest(b: Record<string, unknown>): CheckRequest {
  const source = parseSource(b);
  const raw = b['external_ids'];
  if (!Array.isArray(raw)) throw new HttpError(422, 'external_ids must be an array');
  if (raw.length > MAX_CHECK_IDS) {
    throw new HttpError(422, `external_ids may hold at most ${MAX_CHECK_IDS} entries`);
  }
  const ids = raw.map((id, i) => parseExternalId(id, `external_ids[${i}]`));
  return { source, external_ids: [...new Set(ids)] };
}

/** Keys that already have a task the student has not deleted. */
function liveTaskByKey(rows: ExistingImportRow[]): Map<string, string> {
  const live = new Map<string, string>();
  for (const r of rows) {
    // Deleting a task marks it cancelled (tasksService.remove) rather than
    // removing the row, so a cancelled row is a task the student threw away.
    if (r.status !== 'cancelled' && !live.has(r.import_key)) live.set(r.import_key, r.id);
  }
  return live;
}

/**
 * Decide what an import request does.
 *
 * - An item whose key already has a live task is left alone. Re-importing must
 *   never duplicate, and must never overwrite a task the student has since
 *   edited (moved it, renamed it, given it a subject).
 * - An item whose earlier task was deleted IS created again: the app shows those
 *   as "You removed this" and leaves them unticked, so reaching here means the
 *   student picked it again on purpose.
 * - The same item twice in one request is created once.
 */
export function planImport(source: ImportSource, items: ImportItem[], rows: ExistingImportRow[]): ImportPlan {
  const live = liveTaskByKey(rows);
  const seen = new Set<string>();
  const plan: ImportPlan = { create: [], existing: [], duplicates: 0 };
  for (const item of items) {
    const key = importKey(source, item.external_id);
    if (seen.has(key)) {
      plan.duplicates++;
      continue;
    }
    seen.add(key);
    const taskId = live.get(key);
    if (taskId) plan.existing.push({ item, task_id: taskId });
    else plan.create.push(item);
  }
  return plan;
}

/** POST /integrations/import/check: which ids are in the plan, which were removed. */
export function classifyExisting(
  source: ImportSource,
  externalIds: string[],
  rows: ExistingImportRow[],
): { existing: string[]; removed: string[] } {
  const live = liveTaskByKey(rows);
  const anyRow = new Set(rows.map((r) => r.import_key));
  const existing: string[] = [];
  const removed: string[] = [];
  for (const id of externalIds) {
    const key = importKey(source, id);
    if (live.has(key)) existing.push(id);
    else if (anyRow.has(key)) removed.push(id);
  }
  return { existing, removed };
}

export interface TaskRowContext {
  id: string;
  userId: string;
  /** Already resolved to a study-tag id (or passthrough label). */
  category: string;
  source: ImportSource;
}

/**
 * The tasks row for one imported item — the same shape tasksService.create
 * writes, plus the import provenance.
 *
 * Times follow the tasks contract: the wall-clock time is stored in the UTC
 * position (occurrenceDto reads it back with `toISOString().slice(11, 16)`), so
 * "09:00" is written as `T09:00:00Z` whatever the server's own timezone is.
 */
export function taskRowFor(item: ImportItem, ctx: TaskRowContext) {
  const mins = item.duration_seconds
    ? Math.min(MAX_DURATION_MINS, Math.max(1, Math.round(item.duration_seconds / 60)))
    : DEFAULT_DURATION_MINS;
  const start = item.start_time ? new Date(`${item.date}T${item.start_time}:00.000Z`) : null;
  return {
    id: ctx.id,
    user_id: ctx.userId,
    course_id: null,
    title: item.title,
    estimated_duration_mins: mins,
    scheduled_start_at: start,
    scheduled_end_at: start ? new Date(start.getTime() + mins * 60_000) : null,
    reminder_at: start ? new Date(start.getTime() - REMINDER_LEAD_MS) : null,
    due_at: new Date(`${item.date}T00:00:00.000Z`),
    task_type: ctx.category,
    description: item.note,
    repeat_rule: null,
    planner_section: item.part_of_day,
    status: 'pending',
    priority: 'medium',
    source: IMPORTED_TASK_SOURCE,
    metadata: {
      import_key: importKey(ctx.source, item.external_id),
      import_source: ctx.source,
      external_id: item.external_id,
    },
  };
}
