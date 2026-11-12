// "Done for good" on a repeating task: the app ticks today's occurrence and
// sends `until_date` on the same PATCH, which ends the series at that day.
// These tests pin the occurrence rules that make it stick (and that deleting a
// whole series really removes it), on plain rows — no database.

import { assertEquals } from 'jsr:@std/assert@1';
import { buildOccurrences, occurrenceDto, withUntilDate } from './tasks.service.ts';

const SERIES = '11111111-1111-4111-8111-111111111111';

// deno-lint-ignore no-explicit-any
function seriesRow(over: Record<string, any> = {}) {
  return {
    id: SERIES,
    parent_task_id: null,
    title: 'Read 10 pages',
    status: 'pending',
    due_at: new Date('2026-11-01T00:00:00.000Z'),
    scheduled_start_at: null,
    repeat_rule: JSON.stringify({ repeat_kind: 'daily', repeat_interval: 1, until_date: null }),
    steps: [],
    ...over,
  };
}

// deno-lint-ignore no-explicit-any
function dayRow(date: string, over: Record<string, any> = {}) {
  return {
    id: `row-${date}`,
    parent_task_id: SERIES,
    title: 'Read 10 pages',
    status: 'completed',
    due_at: new Date(`${date}T00:00:00.000Z`),
    scheduled_start_at: null,
    repeat_rule: null,
    steps: [],
    ...over,
  };
}

const idsOn = (rows: unknown[], date: string) => buildOccurrences(rows as never[], date, date).map((o) => o.id);

Deno.test('a daily series ended at D shows its completed day D and nothing on D+1', () => {
  const rule = withUntilDate(seriesRow().repeat_rule, '2026-11-10');
  const rows = [seriesRow({ repeat_rule: rule }), dayRow('2026-11-10')];

  const onD = buildOccurrences(rows, '2026-11-10', '2026-11-10');
  assertEquals(onD.map((o) => o.id), ['row-2026-11-10']);
  assertEquals(onD[0].status, 'COMPLETE');
  assertEquals(idsOn(rows, '2026-11-11'), []);
  assertEquals(idsOn(rows, '2026-12-01'), []);
});

Deno.test('ending a series keeps the history after D (completed per-day rows still render)', () => {
  // "Done for good" from a past day: later days the student already ticked stay.
  const rule = withUntilDate(seriesRow().repeat_rule, '2026-11-05');
  const rows = [seriesRow({ repeat_rule: rule }), dayRow('2026-11-08')];
  assertEquals(idsOn(rows, '2026-11-08'), ['row-2026-11-08']);
  // ...but untouched virtual days after D are gone.
  assertEquals(idsOn(rows, '2026-11-07'), []);
  // ...and days up to D are still there.
  assertEquals(idsOn(rows, '2026-11-05'), [`${SERIES}@2026-11-05`]);
});

Deno.test('without until_date the series keeps going (today stays done, tomorrow is fresh)', () => {
  const rows = [seriesRow(), dayRow('2026-11-10')];
  assertEquals(idsOn(rows, '2026-11-11'), [`${SERIES}@2026-11-11`]);
});

Deno.test('withUntilDate keeps the rule and stores the date the way create does; null re-opens', () => {
  const ended = JSON.parse(withUntilDate(seriesRow().repeat_rule, '2026-11-10'));
  assertEquals(ended.repeat_kind, 'daily');
  assertEquals(ended.repeat_interval, 1);
  assertEquals(ended.until_date, '2026-11-10T00:00:00.000Z');
  assertEquals(JSON.parse(withUntilDate(JSON.stringify(ended), null)).until_date, null);
  // An object column (not a string) is read too.
  assertEquals(JSON.parse(withUntilDate({ repeat_kind: 'weekly' }, '2026-12-01')).repeat_kind, 'weekly');
});

Deno.test("the wire repeat carries until_date, and a per-day row reports its series' rule", () => {
  const rule = withUntilDate(seriesRow().repeat_rule, '2026-11-10');
  const series = seriesRow({ repeat_rule: rule });
  assertEquals(occurrenceDto(series, '2026-11-09').repeat, { kind: 'daily', interval: 1, until_date: '2026-11-10' });
  assertEquals(occurrenceDto(seriesRow(), '2026-11-09').repeat.until_date, null);
  // A ticked (materialised) day used to say `repeat: none`.
  assertEquals(occurrenceDto(dayRow('2026-11-10'), '2026-11-10', series).repeat.kind, 'daily');
  // A one-off has no series.
  assertEquals(occurrenceDto({ ...dayRow('2026-11-10'), parent_task_id: null }, '2026-11-10').repeat.kind, 'none');
});

Deno.test('a deleted (cancelled) series no longer renders any occurrence', () => {
  const rows = [seriesRow({ status: 'cancelled' })];
  assertEquals(idsOn(rows, '2026-11-01'), []);
  assertEquals(idsOn(rows, '2026-11-12'), []);
  // A live series still does.
  assertEquals(idsOn([seriesRow()], '2026-11-12'), [`${SERIES}@2026-11-12`]);
});
