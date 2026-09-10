// The one place the mood scale is converted.
//
// Two scales exist and they are off by one from each other:
//
//   wire     `mood_index` / `mood` — 0..4, a picker index the client sends
//   storage  `mood_score`, `mood_before`, `mood_after`, `subject_feeling`
//            — 1..5, and every one of those columns carries a CHECK
//            constraint refusing anything outside it.
//
// The conversion itself was never the problem; the problem was that it lived in
// two private copies and a third path did not do it at all. `courses` wrote the
// wire index straight into `subject_feeling`, so picking the lowest face sent a
// 0 into a column that refuses 0 and onboarding answered 500 — while the same
// row read back un-shifted, which made the round trip look correct for every
// value except the one that crashed.
//
// Both directions clamp rather than throw. Validation at the router has already
// rejected out-of-range input; a value arriving here that is somehow outside the
// scale should land on the nearest legal score instead of tripping a database
// constraint deep inside a transaction, which is exactly how this surfaced.

/** Wire index (0..4) → stored score (1..5). */
export function moodIndexToScore(index: number): number {
  return Math.min(5, Math.max(1, Math.round(index) + 1));
}

/** Stored score (1..5) → wire index (0..4). Null passes through. */
export function moodScoreToIndex(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return Math.min(4, Math.max(0, Math.round(score) - 1));
}
