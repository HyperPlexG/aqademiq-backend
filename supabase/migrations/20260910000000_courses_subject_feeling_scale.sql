-- Shift `courses.subject_feeling` onto the scale its CHECK constraint always described.
--
-- Every other mood column in this schema stores 1..5 and is fed from a 0..4 wire
-- index (`mood_checkins.mood_score`, `focus_sessions.mood_before/after`).
-- `courses.subject_feeling` carries the same `CHECK (>= 1 AND <= 5)` but the
-- service wrote the wire index into it directly, and read it back the same way.
--
-- Symmetric, so it looked fine: pick the third face, store 3, see the third face
-- again. It was only wrong at the ends — index 0 violated the constraint and
-- onboarding returned 500, and index 4 was never reachable, which is why the
-- live data holds 1,2,3,4 and never 0 or 5.
--
-- The service now converts on both sides. This moves the rows written under the
-- old behaviour so they keep displaying the face the student actually chose:
-- stored 3 read as index 3 before, stored 4 read as index 3 after.
--
-- Bounded and safe: the old range is 1..4, so +1 lands on 2..5 and cannot exceed
-- the constraint. NULL means "never asked" and must stay NULL rather than
-- becoming a reported feeling.
--
-- Not re-runnable on purpose — a second pass would shift the scale again. It is
-- guarded to rows that predate the deploy of the converting service.

update public.courses
set subject_feeling = subject_feeling + 1
where subject_feeling is not null
  and subject_feeling between 1 and 4
  and created_at < '2026-09-10T15:00:32Z';
