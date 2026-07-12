# BUG_FIX_PLAN.md — consolidated remediation (from BUGS.md, grounded in code diagnosis)

57 diagnosed findings → **10 workstreams by shared root cause**. Each workstream adds/uses one clean seam and resolves a whole cluster (no per-screen spaghetti). IDs map to `docs/BUGS.md`.

Legend: ✅ fixable now · ⛔ needs real backend (make graceful) · ✎ design decision.

---

## WS1 — Keyboard handling (shared seam) ✅
**Root cause:** no sheet pads for `MediaQuery.viewInsets.bottom` (grep: `viewInsets` used nowhere); full-screen text forms have no tap-to-dismiss.
**Fix (once):** add keyboard-inset padding + scroll to the shared `AppBottomSheet` shell; route the bespoke sheets (`input_sheet`, `add_tag_sheet`, `add_semester_sheet`, `subject_form_sheet`) through it. Add a shared `DismissKeyboard` wrapper (tap-outside → `FocusScope.unfocus`) for full-screen forms.
**Fixes:** PROF-1, PROF-5, TAG-2(kbd), SUBJ-1, PLAN-9, STA-3(kbd).

## WS2 — Bottom-nav clearance (single contract) ✅
**Root cause:** floating nav painted over content; clearance is ad-hoc (AppScaffold hardcodes 92, AdaScreen 76, Timer reserves nothing).
**Fix (once):** one `BottomNav.height` const → derive `AppScaffold.navClearance`; route AdaScreen + Focus through it; make Focus setup/running scrollable so primary actions never tuck under the nav.
**Fixes:** GLOB-1, ADA-1(overlap), FOC-3(overlap), PLAN-2(overlap), STA-5(overlap).

## WS3 — Profile/account persistence (new `ProfileController` seam) ✅
**Root cause:** edit sheets return a value the caller **discards** (`unawaited(...)`); no profile provider; row values are literals.
**Fix:** `ProfileController` (Notifier over `AppUser`) + `ProfileRepository.update…`; settings rows read from the provider and `await` the sheet result into it.
**Fixes:** PROF-2, PROF-3, PROF-5(save), PROF-7, PROF-8. (PROF-6 password: local validate now, real change ⛔. PROF-4 DOB, PROF-9 Health: ✎ scope.)

## WS4 — Tags CRUD (new `TagsController` seam) ✅
**Root cause:** tags are read-only; rendered from `const` lists; create/remove unwired; add-task saves `tagId: _subject` (wrong field).
**Fix:** `TagsSource.create/delete` (mutable mock store) + `TagsController` (AsyncNotifier) invalidating `tagsProvider`; Settings tags card + add-task tag chips both read `tagsProvider`; add-task writes the correct tag.
**Fixes:** TAG-1, TAG-2(save), PLAN-5, PLAN-11.

## WS5 — Mood + Stats from live data ✅
**Root cause:** Stats/mood UI reads **static fixtures**; mood writes don't invalidate display providers; completed/streak are constants.
**Fix:** drive Stats mood-week + evening "this week" from `moodWeekProvider`; invalidate `moodWeekProvider`/`statsProvider` after a log; derive weekly-completed from tasks; derive streak client-side.
**Fixes:** STA-2, STA-3(save), STA-4, STA-6, PLAN-2(log→stats).

## WS6 — Plan task operations (write seams) ✅
**Root cause:** reschedule/move/start-session/repeat are presentational mocks; bucketing duplicated; no shared draft.
**Fixes:**
- PLAN-1 — single `taskBucket(Task)` seam (use `dayPart`/`startTime`); verify fixture isn't double-listing.
- PLAN-3/PLAN-4 — `collapsedGroupsProvider` + wire `ListGroupHead.onTap/onAdd`.
- PLAN-7 — repeat picker returns a `RepeatRule`; recurrence expansion in `TasksRepository`.
- PLAN-8 — `taskDraftProvider` bridging quick-add ↔ full add-task.
- PLAN-10 — "None" chip (drop "+", clears selection).
- PLAN-12 — start-session routes intent through focus controller (`configure`+`start`) + linked-task provider.
- PLAN-14/PLAN-15 — `DayTasksController.move(task, date)`; reschedule sheet bound to real tasks.

## WS7 — Subjects & Semesters CRUD ✅
**Root cause:** no subject update, no semesters CRUD / selected-semester; forms static.
**Fix:** `SubjectsRepository.upsert` + `Subject.toDto` adapter + `SubjectsController`; `SemestersController` + `upsertSemester` + `selectedSemesterProvider`; edit-semesters bound to provider; subject form accepts an existing subject and saves; missing-file nudge → add-file.
**Fixes:** SUBJ-2, SUBJ-3, SUBJ-5, SUBJ-6. (SUBJ-4 open real file ⛔ partial.)

## WS8 — Dead-end actions & navigation ✅
**Root cause:** static rows/labels with no `onTap`; missing routes.
**Fix:** wire handlers; Rate→`showRateSheet`; Forgot-password route; Privacy/Terms + Feedback/FAQ via `url_launcher`; Prism default-mode picker + prefs; Notification time picker + prefs.
**Fixes:** STA-1, ONB-4, ABOUT-1, PRISM-1, NOTIF-1. (PRISM-2/3 calendar/reminder import ⛔; ADA-2 upload ⛔; ADA-3 needs a conversations model — medium.)

## WS9 — Focus polish ✅
- FOC-4 — animate the melt with `TweenAnimationBuilder` (per-tick deltas are imperceptible today).
- FOC-2 — dark-mode prism dropdown hardcodes `Colors.white` → use `colors.surface`; apply selected mode to session. (Audio ⛔.)
- FOC-3 — see WS6/WS2 (real linked Task + completion writes back).
- FOC-1, FOC-5 — ✎ design.

## WS10 — Onboarding ✅
- ONB-1 — `SubjectFormSheet` Save returns the subject → onboarding draft (rides WS7 form fix).
- ONB-3 — multi-select peak time (`List<String>` + `togglePeakTime`).
- ONB-4 — forgot-password (WS8). ONB-2 syllabus upload ⛔.

---

## ⛔ Backend-deferred (made graceful: clear disabled / "processing", never fake success)
ONB-2 syllabus upload · PLAN-6 voice mic · PLAN-13 Ada breakdown (AI) · ADA-2 chat file upload · FOC-2 Prism audio · PRISM-2/3 calendar+reminder import · SUBJ-4 open real file · PROF-6 real password change. (All wire for real in Prompt C.)

## ✎ Design decisions
FOC-1 Focus spacing/title scale · FOC-5 set-time chip width · PROF-4 Date of birth (ship vs drop) · PROF-9 Health field (ship vs drop) · ADA-3 multi-conversation history (full feature vs simplify).

## Notes
- The build on the phone is from days ago; several "coming soon" reports may already differ in current code. All fixes are verified against **current** code; I'll redeploy a fresh build after.
- Verification per fix: `flutter analyze` clean + tests; behavioral fixes run in the simulator/macOS; adversarial review on the riskier seams.
