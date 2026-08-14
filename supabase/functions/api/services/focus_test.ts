// Tests for the focus-session arithmetic the Prism analytics depend on.
//
// These three functions decide what every downstream metric is computed from,
// and they fail quietly: a wrong pause total or a dropped task link does not
// throw, it just produces plausible numbers that are wrong. That is exactly how
// the table ended up with 0 rows carrying an end time and 40 of 47 completed
// sessions recording 0 minutes without anyone noticing.

import { assertEquals } from 'jsr:@std/assert@1';
import { closePause, seriesIdOf, studiedMinutes } from './focus.service.ts';

const T = (iso: string) => new Date(iso);

// ---- seriesIdOf ----------------------------------------------------------

Deno.test('an occurrence id is reduced to the series id', () => {
  // focus_sessions.task_id is a real FK. Storing "<uuid>@<date>" violates it,
  // which is why starting a session from a repeating task never linked.
  assertEquals(
    seriesIdOf('9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21@2026-08-14'),
    '9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21',
  );
});

Deno.test('a plain task id passes through', () => {
  assertEquals(
    seriesIdOf('9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21'),
    '9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21',
  );
});

Deno.test('junk becomes null rather than a foreign-key violation', () => {
  // Null is a session with no task. A bad id would 500 the whole start call.
  assertEquals(seriesIdOf('not-a-uuid'), null);
  assertEquals(seriesIdOf(''), null);
  assertEquals(seriesIdOf(undefined), null);
});

// ---- closePause ----------------------------------------------------------

Deno.test('an open pause is priced by wall clock and the marker removed', () => {
  const r = closePause({ paused_at: '2026-08-14T10:00:00.000Z' }, T('2026-08-14T10:07:00.000Z'));
  assertEquals(r.minutes, 7);
  assertEquals(r.metadata, {});
});

Deno.test('closing with no open pause costs nothing', () => {
  const r = closePause({ other: 'kept' }, T('2026-08-14T10:07:00.000Z'));
  assertEquals(r.minutes, 0);
  assertEquals(r.metadata, { other: 'kept' });
});

Deno.test('unrelated metadata survives closing a pause', () => {
  // metadata is shared; clobbering it would lose whatever else lives there.
  const r = closePause(
    { paused_at: '2026-08-14T10:00:00.000Z', source: 'timer' },
    T('2026-08-14T10:02:00.000Z'),
  );
  assertEquals(r.minutes, 2);
  assertEquals(r.metadata, { source: 'timer' });
});

Deno.test('a clock that went backwards yields 0, never negative minutes', () => {
  // A negative pause would inflate studied time via the wall-clock fallback.
  const r = closePause({ paused_at: '2026-08-14T10:10:00.000Z' }, T('2026-08-14T10:00:00.000Z'));
  assertEquals(r.minutes, 0);
});

Deno.test('a malformed paused_at is ignored', () => {
  assertEquals(closePause({ paused_at: 'yesterday' }, T('2026-08-14T10:00:00.000Z')).minutes, 0);
  assertEquals(closePause(null, T('2026-08-14T10:00:00.000Z')).minutes, 0);
});

// ---- studiedMinutes ------------------------------------------------------

Deno.test('the client elapsed count wins when present', () => {
  // It already excludes paused time, so pausedMins must not be subtracted again.
  assertEquals(studiedMinutes(1500, T('2026-08-14T10:00:00Z'), T('2026-08-14T10:40:00Z'), 15), 25);
});

Deno.test('elapsed seconds round rather than floor', () => {
  // The old Math.floor recorded a 24m50s session as 24 minutes.
  assertEquals(studiedMinutes(1490, T('2026-08-14T10:00:00Z'), T('2026-08-14T10:25:00Z'), 0), 25);
});

Deno.test('without an elapsed count it falls back to wall clock minus pauses', () => {
  // A session whose client died still records something truthful.
  assertEquals(
    studiedMinutes(undefined, T('2026-08-14T10:00:00Z'), T('2026-08-14T11:00:00Z'), 10),
    50,
  );
});

Deno.test('a session that was paused longer than it ran reports 0, not negative', () => {
  assertEquals(
    studiedMinutes(undefined, T('2026-08-14T10:00:00Z'), T('2026-08-14T10:10:00Z'), 30),
    0,
  );
});

Deno.test('elapsed_sec of 0 falls through to the wall clock', () => {
  // 0 is what the app sends for a session it never ticked. Trusting it would
  // write another zero-minute row — the exact shape of the existing damage.
  assertEquals(
    studiedMinutes(0, T('2026-08-14T10:00:00Z'), T('2026-08-14T10:30:00Z'), 0),
    30,
  );
});
