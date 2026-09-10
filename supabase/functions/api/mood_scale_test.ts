// The mood scale, and the one value that used to break it.
//
// Reported as "the lowest subject mood won't go through during onboarding". It
// was not validation — the router accepts 0..4 everywhere. It was that the
// `courses` path wrote the wire index straight into `subject_feeling`, a column
// with `CHECK (subject_feeling >= 1 AND <= 5)`. Index 0 hit that constraint deep
// inside the onboarding transaction and surfaced as a 500.
//
// What made it survive review is that the bug was symmetric: the same path read
// the column back without shifting either, so every value except 0 round-tripped
// to the right face. Only the bottom of the scale ever failed.

import { assertEquals } from 'jsr:@std/assert@1';
import { moodIndexToScore, moodScoreToIndex } from '../_shared/mood.ts';

Deno.test('the lowest face produces a score the database will accept', () => {
  // The whole bug. 0 + no conversion = constraint violation = HTTP 500.
  assertEquals(moodIndexToScore(0), 1);
});

Deno.test('the highest face stays inside the scale', () => {
  // The mirror of the bug, and why adding 1 on the client would not have worked:
  // the wire caps at 4, so a client sending 5 is rejected by the router before
  // any of this runs.
  assertEquals(moodIndexToScore(4), 5);
});

Deno.test('every wire index maps into the stored range', () => {
  for (let i = 0; i <= 4; i++) {
    const score = moodIndexToScore(i);
    assertEquals(score >= 1 && score <= 5, true, `index ${i} produced ${score}`);
  }
});

Deno.test('a mood survives the round trip unchanged', () => {
  // What the student picked is what the student sees again.
  for (let i = 0; i <= 4; i++) {
    assertEquals(moodScoreToIndex(moodIndexToScore(i)), i);
  }
});

Deno.test('every stored score maps back onto a real face', () => {
  for (let s = 1; s <= 5; s++) {
    const idx = moodScoreToIndex(s);
    assertEquals(idx !== null && idx >= 0 && idx <= 4, true, `score ${s} produced ${idx}`);
  }
});

Deno.test('an unset mood stays unset rather than becoming the lowest face', () => {
  // `subject_feeling` is nullable and null means "never asked". Turning that
  // into 0 would invent a bad feeling the student never reported.
  assertEquals(moodScoreToIndex(null), null);
  assertEquals(moodScoreToIndex(undefined), null);
});

Deno.test('out-of-range input clamps instead of reaching the constraint', () => {
  // Validation already rejects these at the router. If one ever gets past, the
  // nearest legal score beats a constraint violation inside a transaction —
  // which is precisely how this bug reached production.
  assertEquals(moodIndexToScore(-3), 1);
  assertEquals(moodIndexToScore(99), 5);
  assertEquals(moodScoreToIndex(0), 0);
  assertEquals(moodScoreToIndex(9), 4);
});
