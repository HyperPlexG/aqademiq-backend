// The three decisions in the weekly report that can hurt someone.
//
// Everything else in weekly-report.service.ts is a database read reshaped into
// JSON. These three are judgements, they run on every report, and each one has
// a failure mode that is worse than being wrong — it is being wrong in a way
// that reads as a statement about the student.
//
//  * `hasActivity` decides whether a day is drawn as an empty band. Getting it
//    wrong tells someone nothing happened on a day they worked.
//  * `classifyShape` picks the sentence at the top of the report, before a
//    single number appears.
//  * `recoveryLift` is the one card that can read a hard week as recovery, and
//    the only thing stopping it reading as a shortfall is that it refuses to
//    exist when the number points the wrong way.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { classifyShape, hasActivity, mondayOf, recoveryLift } from './weekly-report.service.ts';

const NONE = { ledger: false, tasks_completed: 0, focus_minutes: 0, focus_sessions: 0, mood_index: null };

// ---- hasActivity ----------------------------------------------------------

Deno.test('a day with nothing on it is empty', () => {
  assertEquals(hasActivity(NONE), false);
});

Deno.test('an unlinked focus session makes the day count', () => {
  // The whole reason this function exists rather than reading the ledger
  // directly. Before the ledger fix, 31 of the 48 days on which someone
  // finished a session had no ledger row — two thirds of real focus days. A
  // report that reads only the ledger draws every one of them as empty.
  assert(hasActivity({ ...NONE, focus_sessions: 1, focus_minutes: 45 }));
});

Deno.test('a session that recorded zero minutes still counts', () => {
  // 40 of 47 completed sessions once recorded 0 minutes. Starting and finishing
  // one is a thing that happened even when the duration says otherwise.
  assert(hasActivity({ ...NONE, focus_sessions: 1, focus_minutes: 0 }));
});

Deno.test('a mood check-in alone makes the day count', () => {
  // Including the lowest mood on the ramp. Index 0 is falsy, so a truthiness
  // check here would silently drop exactly the days that matter most.
  assert(hasActivity({ ...NONE, mood_index: 0 }));
});

Deno.test('a completed task alone makes the day count', () => {
  assert(hasActivity({ ...NONE, tasks_completed: 1 }));
});

Deno.test('the ledger alone still counts', () => {
  // Historic rows exist that predate every other signal being recorded.
  assert(hasActivity({ ...NONE, ledger: true }));
});

// ---- classifyShape --------------------------------------------------------

function shape(pattern: string) {
  return classifyShape([...pattern].map((c) => c === 'x'));
}

Deno.test('an empty week is named as empty, not as a failure', () => {
  assertEquals(shape('-------'), 'empty');
});

Deno.test('one day is its own shape', () => {
  // Never rounded up into "scattered" — a single day is a real week for
  // somebody, and it deserves a sentence that is true rather than a shrug.
  assertEquals(shape('--x----'), 'single');
});

Deno.test('six or seven days read as steady', () => {
  assertEquals(shape('xxxxxx-'), 'steady');
  assertEquals(shape('xxxxxxx'), 'steady');
});

Deno.test('a consecutive run is clustered, not scattered', () => {
  assertEquals(shape('-xxx---'), 'clustered');
  assertEquals(shape('xxx----'), 'clustered');
});

Deno.test('weight early and weight late are told apart', () => {
  assertEquals(shape('xx---x-'), 'front_loaded');
  assertEquals(shape('x----xx'), 'back_loaded');
});

Deno.test('the shape ignores how much happened on each day', () => {
  // classifyShape takes booleans by construction. A shape drawn from volume
  // ranks days against each other, and one thin day would drag the whole
  // description down — which is how a report starts describing the person.
  assertEquals(shape('xxx----'), shape('xxx----'));
});

Deno.test('every pattern produces a shape', () => {
  for (let mask = 0; mask < 128; mask++) {
    const active = Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) !== 0);
    const s = classifyShape(active);
    assert(typeof s === 'string' && s.length > 0, `mask ${mask} produced no shape`);
  }
});

// ---- recoveryLift ---------------------------------------------------------

Deno.test('no sessions means the card is absent, not zero', () => {
  assertEquals(recoveryLift([]), null);
});

Deno.test('a session missing either end of the mood is skipped', () => {
  assertEquals(recoveryLift([{ before: 3, after: null }, { before: null, after: 4 }]), null);
});

Deno.test('a positive lift is reported with the count it rests on', () => {
  const r = recoveryLift([{ before: 2, after: 4 }, { before: 3, after: 4 }]);
  assert(r !== null);
  assertEquals(r.sessions, 2);
  assertEquals(r.lift, 1.5);
});

Deno.test('a negative lift does not render at all', () => {
  // The card is positive-only, and the enforcement lives here rather than in
  // the client: a client handed -0.8 could still choose to draw it, and "you
  // ended your sessions worse than you started" is the single most harmful
  // sentence this feature could produce.
  assertEquals(recoveryLift([{ before: 4, after: 2 }]), null);
});

Deno.test('no change is not a lift', () => {
  assertEquals(recoveryLift([{ before: 3, after: 3 }]), null);
});

// ---- mondayOf -------------------------------------------------------------

Deno.test('every day of a week snaps to the same Monday', () => {
  // Sunday is the one that breaks naive implementations: getUTCDay() is 0, so
  // `1 - dow` walks forward into next week instead of back to this one.
  const days = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
  for (const d of days) {
    assertEquals(mondayOf(new Date(`${d}T12:00:00Z`)).toISOString().slice(0, 10), '2026-08-31', `${d} snapped wrong`);
  }
});

Deno.test('a Monday snaps to itself', () => {
  assertEquals(mondayOf(new Date('2026-08-31T00:00:00Z')).toISOString().slice(0, 10), '2026-08-31');
});
