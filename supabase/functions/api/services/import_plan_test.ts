// Calendar & reminder import (v2): the decisions made in code.
//
// What is worth pinning here:
//  * Re-importing never duplicates and never overwrites. A student imports
//    their timetable every few weeks; anything already in the plan (and maybe
//    edited since) must be left exactly as it is.
//  * A task the student deleted is not silently resurrected by `check` — it is
//    reported as removed so the app can leave it unticked.
//  * The task row matches what tasksService.create writes, in particular the
//    wall-clock-in-UTC time convention and the 10-minute reminder lead.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError } from '../../_shared/http.ts';
import {
  classifyExisting,
  DEFAULT_DURATION_MINS,
  type ExistingImportRow,
  type ImportItem,
  importKey,
  MAX_IMPORT_ITEMS,
  MAX_TITLE,
  parseCheckRequest,
  parseImportItem,
  parseImportRequest,
  planImport,
  REMINDER_LEAD_MS,
  taskRowFor,
} from './import_plan.ts';

function item(overrides: Partial<ImportItem> = {}): ImportItem {
  return {
    external_id: 'evt-1@1793174400000',
    title: 'CS F211 Lecture',
    date: '2026-10-28',
    start_time: '09:00',
    duration_seconds: 3000,
    part_of_day: 'morning',
    note: null,
    ...overrides,
  };
}

function row(externalId: string, status: string, id = `task-${externalId}`): ExistingImportRow {
  return { id, status, import_key: importKey('device_calendar', externalId) };
}

// ---- validation ------------------------------------------------------------

Deno.test('an import names its source', () => {
  assertThrows(() => parseImportRequest({ items: [item()] }), HttpError);
  assertThrows(() => parseImportRequest({ source: 'outlook', items: [item()] }), HttpError);
});

Deno.test('an import carries at least one item and at most the batch cap', () => {
  assertThrows(() => parseImportRequest({ source: 'ics', items: [] }), HttpError);
  assertThrows(() => parseImportRequest({ source: 'ics' }), HttpError);
  const tooMany = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => item({ external_id: `e${i}` }));
  assertThrows(() => parseImportRequest({ source: 'ics', items: tooMany }), HttpError);
  const justRight = tooMany.slice(0, MAX_IMPORT_ITEMS);
  assertEquals(parseImportRequest({ source: 'ics', items: justRight }).items.length, MAX_IMPORT_ITEMS);
});

Deno.test('a blank title is refused, the same rule as creating a task by hand', () => {
  assertThrows(() => parseImportItem({ ...item(), title: '   ' }, 0), HttpError);
  assertThrows(() => parseImportItem({ ...item(), title: undefined }, 0), HttpError);
});

Deno.test('a long title is cut to the column width instead of failing the batch', () => {
  const parsed = parseImportItem({ ...item(), title: 'x'.repeat(400) }, 0);
  assertEquals(parsed.title.length, MAX_TITLE);
});

Deno.test('whitespace inside a title is collapsed', () => {
  assertEquals(parseImportItem({ ...item(), title: '  Lab \n  report\tdue ' }, 0).title, 'Lab report due');
});

Deno.test('dates must be real calendar days and times must be HH:mm', () => {
  assertThrows(() => parseImportItem({ ...item(), date: '2026-02-30' }, 0), HttpError);
  assertThrows(() => parseImportItem({ ...item(), date: '28/10/2026' }, 0), HttpError);
  assertThrows(() => parseImportItem({ ...item(), start_time: '9:00' }, 0), HttpError);
  assertThrows(() => parseImportItem({ ...item(), start_time: '24:00' }, 0), HttpError);
  assertEquals(parseImportItem({ ...item(), date: '2028-02-29' }, 0).date, '2028-02-29');
});

Deno.test('an untimed item becomes an anytime task with no duration', () => {
  const parsed = parseImportItem(
    { external_id: 'r-1', title: 'Pay hostel fee', date: '2026-10-30' },
    0,
  );
  assertEquals(parsed.start_time, null);
  assertEquals(parsed.duration_seconds, null);
  assertEquals(parsed.part_of_day, 'anytime');
  assertEquals(parsed.note, null);
});

Deno.test('an unknown part of day is refused', () => {
  assertThrows(() => parseImportItem({ ...item(), part_of_day: 'night' }, 0), HttpError);
});

Deno.test('a blank category means untagged', () => {
  assertEquals(parseImportRequest({ source: 'text', category: '  ', items: [item()] }).category, null);
  assertEquals(parseImportRequest({ source: 'text', items: [item()] }).category, null);
  assertEquals(parseImportRequest({ source: 'text', category: 'Lecture', items: [item()] }).category, 'Lecture');
});

Deno.test('check drops repeated ids and validates each one', () => {
  const parsed = parseCheckRequest({ source: 'ics', external_ids: ['a', 'b', 'a'] });
  assertEquals(parsed.external_ids, ['a', 'b']);
  assertThrows(() => parseCheckRequest({ source: 'ics', external_ids: ['a', ''] }), HttpError);
  assertThrows(() => parseCheckRequest({ source: 'ics', external_ids: 'a' }), HttpError);
});

// ---- what an import does ---------------------------------------------------

Deno.test('a fresh import creates every item', () => {
  const plan = planImport('device_calendar', [item({ external_id: 'a' }), item({ external_id: 'b' })], []);
  assertEquals(plan.create.map((i) => i.external_id), ['a', 'b']);
  assertEquals(plan.existing.length, 0);
  assertEquals(plan.duplicates, 0);
});

Deno.test('importing the same calendar again leaves what is already in the plan alone', () => {
  const plan = planImport(
    'device_calendar',
    [item({ external_id: 'a' }), item({ external_id: 'b' })],
    [row('a', 'pending')],
  );
  assertEquals(plan.create.map((i) => i.external_id), ['b']);
  assertEquals(plan.existing, [{ item: item({ external_id: 'a' }), task_id: 'task-a' }]);
});

Deno.test('a completed import is still "in the plan" — ticking it off is not deleting it', () => {
  const plan = planImport('device_calendar', [item({ external_id: 'a' })], [row('a', 'completed')]);
  assertEquals(plan.create.length, 0);
  assertEquals(plan.existing.length, 1);
});

Deno.test('an item whose task was deleted is created again when picked again', () => {
  const plan = planImport('device_calendar', [item({ external_id: 'a' })], [row('a', 'cancelled')]);
  assertEquals(plan.create.map((i) => i.external_id), ['a']);
});

Deno.test('a live copy wins over a deleted one for the same item', () => {
  const plan = planImport(
    'device_calendar',
    [item({ external_id: 'a' })],
    [row('a', 'cancelled', 'old'), row('a', 'pending', 'new')],
  );
  assertEquals(plan.existing, [{ item: item({ external_id: 'a' }), task_id: 'new' }]);
});

Deno.test('the same item twice in one request is created once', () => {
  const plan = planImport('device_calendar', [item({ external_id: 'a' }), item({ external_id: 'a' })], []);
  assertEquals(plan.create.length, 1);
  assertEquals(plan.duplicates, 1);
});

Deno.test('the same external id from a different source is a different item', () => {
  // An .ics UID and a device event id can collide; they are not the same thing.
  const rows = [{ id: 't', status: 'pending', import_key: importKey('ics', 'a') }];
  assertEquals(planImport('device_calendar', [item({ external_id: 'a' })], rows).create.length, 1);
});

Deno.test('check tells live tasks from deleted ones and ignores unknown ids', () => {
  const result = classifyExisting(
    'device_calendar',
    ['live', 'gone', 'never'],
    [row('live', 'pending'), row('gone', 'cancelled')],
  );
  assertEquals(result, { existing: ['live'], removed: ['gone'] });
});

// ---- the task row ----------------------------------------------------------

const ctx = { id: 'new-id', userId: 'user-1', category: 'tag-1', source: 'device_calendar' as const };

Deno.test('a timed item is stored in the tasks wall-clock convention', () => {
  const r = taskRowFor(item(), ctx);
  // 09:00 for 50 minutes, written in the UTC position like every other task.
  assertEquals(r.scheduled_start_at?.toISOString(), '2026-10-28T09:00:00.000Z');
  assertEquals(r.scheduled_end_at?.toISOString(), '2026-10-28T09:50:00.000Z');
  assertEquals(r.due_at.toISOString(), '2026-10-28T00:00:00.000Z');
  assertEquals(r.estimated_duration_mins, 50);
});

Deno.test('a timed item gets the same before-task reminder as one made by hand', () => {
  const r = taskRowFor(item(), ctx);
  assertEquals(r.reminder_at?.getTime(), r.scheduled_start_at!.getTime() - REMINDER_LEAD_MS);
  assertEquals(r.reminder_at?.toISOString(), '2026-10-28T08:50:00.000Z');
});

Deno.test('an untimed item has no time, no reminder and the default duration', () => {
  const r = taskRowFor(item({ start_time: null, duration_seconds: null, part_of_day: 'anytime' }), ctx);
  assertEquals(r.scheduled_start_at, null);
  assertEquals(r.scheduled_end_at, null);
  assertEquals(r.reminder_at, null);
  assertEquals(r.estimated_duration_mins, DEFAULT_DURATION_MINS);
  assertEquals(r.planner_section, 'anytime');
});

Deno.test('the row records where it came from, so the next import can find it', () => {
  const r = taskRowFor(item(), ctx);
  // One of the values the live tasks_source_check constraint allows; anything
  // else fails the insert (see IMPORTED_TASK_SOURCE).
  assertEquals(r.source, 'calendar_import');
  assertEquals(
    ['manual', 'ada', 'calendar_import', 'material_import'].includes(r.source),
    true,
  );
  assertEquals(r.status, 'pending');
  assertEquals(r.user_id, 'user-1');
  assertEquals(r.task_type, 'tag-1');
  assertEquals(r.repeat_rule, null);
  assertEquals(r.metadata, {
    import_key: 'device_calendar:evt-1@1793174400000',
    import_source: 'device_calendar',
    external_id: 'evt-1@1793174400000',
  });
});

Deno.test('a duration is rounded to minutes and capped at a day', () => {
  assertEquals(taskRowFor(item({ duration_seconds: 89 }), ctx).estimated_duration_mins, 1);
  assertEquals(taskRowFor(item({ duration_seconds: 5400 }), ctx).estimated_duration_mins, 90);
  assertEquals(taskRowFor(item({ duration_seconds: 3 * 86_400 }), ctx).estimated_duration_mins, 24 * 60);
});
