// Tests for the free/busy arithmetic.
//
// Run with:  deno test api/agent/schedule_test.ts   (from supabase/functions/)
//
// Only the pure half is covered — `computeFreeSlots` — which is where the risk
// actually is. A bug here does not throw; it silently reports a slot as free
// that is already taken, and Ada then schedules study on top of a lecture. The
// I/O half (busyBlocks) is thin by comparison: two queries and a shape mapping.

import { assertEquals } from 'jsr:@std/assert@1';
import { type BusyBlock, computeFreeSlots } from './schedule.ts';

const DAY = '2026-08-10';
const OPTS = { dayStart: '08:00', dayEnd: '22:00', minMinutes: 25 };

function busy(start: string, end: string, title = 'x'): BusyBlock {
  return { date: DAY, start, end, title, source: 'task' };
}

Deno.test('an empty day is one long slot', () => {
  const free = computeFreeSlots([], [DAY], OPTS);
  assertEquals(free, [{ date: DAY, start: '08:00', end: '22:00', minutes: 840 }]);
});

Deno.test('a single commitment splits the day around it', () => {
  const free = computeFreeSlots([busy('10:00', '11:00')], [DAY], OPTS);
  assertEquals(free.map((f) => [f.start, f.end]), [['08:00', '10:00'], ['11:00', '22:00']]);
});

Deno.test('overlapping commitments merge instead of creating a phantom gap', () => {
  // 10:00-11:00 and 10:30-12:00 overlap. Treated separately they would leave a
  // nonsensical "free" sliver between 11:00 and 10:30.
  const free = computeFreeSlots([busy('10:00', '11:00'), busy('10:30', '12:00')], [DAY], OPTS);
  assertEquals(free.map((f) => [f.start, f.end]), [['08:00', '10:00'], ['12:00', '22:00']]);
});

Deno.test('a fully contained commitment does not reopen the outer one', () => {
  const free = computeFreeSlots([busy('09:00', '17:00'), busy('11:00', '12:00')], [DAY], OPTS);
  assertEquals(free.map((f) => [f.start, f.end]), [['08:00', '09:00'], ['17:00', '22:00']]);
});

Deno.test('gaps shorter than min_minutes are not offered', () => {
  // 10:00-10:15 is a 15-minute gap, below the 25-minute floor.
  const free = computeFreeSlots([busy('08:00', '10:00'), busy('10:15', '22:00')], [DAY], OPTS);
  assertEquals(free, []);
});

Deno.test('commitments outside the waking window do not leak into it', () => {
  const free = computeFreeSlots([busy('06:00', '07:00'), busy('23:00', '23:30')], [DAY], OPTS);
  assertEquals(free, [{ date: DAY, start: '08:00', end: '22:00', minutes: 840 }]);
});

Deno.test('a commitment straddling the window edge only clips the overlap', () => {
  const free = computeFreeSlots([busy('07:00', '09:00')], [DAY], OPTS);
  assertEquals(free.map((f) => [f.start, f.end]), [['09:00', '22:00']]);
});

Deno.test('a day booked solid yields nothing', () => {
  const free = computeFreeSlots([busy('07:00', '23:00')], [DAY], OPTS);
  assertEquals(free, []);
});

Deno.test('unsorted input is handled — arrival order is not assumed', () => {
  const free = computeFreeSlots([busy('15:00', '16:00'), busy('09:00', '10:00')], [DAY], OPTS);
  assertEquals(free.map((f) => [f.start, f.end]), [
    ['08:00', '09:00'],
    ['10:00', '15:00'],
    ['16:00', '22:00'],
  ]);
});

Deno.test('each day is computed independently', () => {
  const d2 = '2026-08-11';
  const blocks: BusyBlock[] = [
    busy('09:00', '10:00'),
    { date: d2, start: '14:00', end: '15:00', title: 'y', source: 'calendar' },
  ];
  const free = computeFreeSlots(blocks, [DAY, d2], OPTS);
  assertEquals(free.filter((f) => f.date === DAY).map((f) => [f.start, f.end]), [
    ['08:00', '09:00'],
    ['10:00', '22:00'],
  ]);
  assertEquals(free.filter((f) => f.date === d2).map((f) => [f.start, f.end]), [
    ['08:00', '14:00'],
    ['15:00', '22:00'],
  ]);
});

Deno.test('a day with no blocks at all still reports free time', () => {
  const d2 = '2026-08-11';
  const free = computeFreeSlots([busy('09:00', '10:00')], [DAY, d2], OPTS);
  assertEquals(free.filter((f) => f.date === d2), [
    { date: d2, start: '08:00', end: '22:00', minutes: 840 },
  ]);
});
