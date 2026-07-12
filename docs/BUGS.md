# BUGS.md — remediation tracker (from "Edited List.docx", 2026-06-20)

Stable IDs per area. Status: ☐ open · ◐ partial · ☑ fixed · ⛔ backend-blocked (made graceful) · ✎ design.
Verification baseline after fixes: `flutter analyze` → **No issues found!** · `flutter test` → **all pass**.

## Global
- **GLOB-1** ☑ Nav overlap → single `AppScaffold.navClearanceOf` contract from `BottomNav.height` + real home-indicator inset (old fixed-92 under-cleared notched devices).

## Onboarding
- **ONB-1** ☑ "What are you studying" → add subject now saves (form has real fields + working Save) and the name lands in the onboarding draft.
- **ONB-2** ⛔ Syllabus upload → needs GCS backend (graceful).
- **ONB-3** ☑ "When do you work best" is now multi-select (`togglePeakTime`).
- **ONB-4** ☑ Sign in → "Forgot password?" is tappable (honest "coming soon"; real reset is §8).

## Focus
- **FOC-1** ☑ Verified against the v5 spec — title 32 / IceTimer 150 / Start pad 13×40 already match; nav clearance (GLOB-1) keeps Start off the bar.
- **FOC-2** ☑ Dark-mode prism dropdown used `Colors.white` → `colors.surface` (readable); mode selection applies. Audio playback ⛔.
- **FOC-3** ☑ Link sheet lists real tasks; linked task drives the chip and is marked **done** when the session completes (`linkedTaskProvider`).
- **FOC-4** ☑ Ice-cube melt now animates between ticks via `TweenAnimationBuilder` (the prototype's 0.9s arc transition).
- **FOC-5** ☑ Set-time preset chips already flex full-width per spec.

## Stats / Profile hub
- **STA-1** ☑ Rate → sheet; Feedback/FAQ/Instagram → `openExternal` (url_launcher).
- **STA-2** ☑ Logging mood (any entry point) invalidates `moodWeekProvider`; Stats mood card is live.
- **STA-3** ☑ Evening reflection persists (logged against the demo day) + keyboard dismiss; week card is live.
- **STA-4** ☑ Completed count derives from tasks (`weeklyCompletedProvider`), invalidated on toggle.
- **STA-5** ☑ Real OS share via `share_plus`; clears the nav.
- **STA-6** ☑ Day streak derived client-side from consecutive logged days (`streakProvider`).

## Settings → Profile
- **PROF-1/2/3/4/5/7/8/9** ☑ All rows read/write `ProfileController` (shared with hub + Stats); sheets on the keyboard-aware `AppBottomSheet`; DOB date-picker + Health are real fields.
- **PROF-6** ◐ Password sheet keyboard-fixed + validates locally; real change ⛔ (§8) — reports honestly.

## Settings → Study tags
- **TAG-1** ☑ "x" removes (`TagsController.remove`). **TAG-2** ☑ New tag persists + keyboard fixed.

## Settings → Preferences / About
- **NOTIF-1** ☑ "At time" rows open a real time picker (persist in state).
- **PRISM-1** ☑ Default mode picker + `prismDefaultModeProvider` (reflected in the hub).
- **PRISM-2/3** ⛔ Calendar/Reminder import → honest "coming soon" taps (was dead).
- **ABOUT-1** ☑ Privacy/Terms open via `openExternal`.

## Plan
- **PLAN-1** ☑ Single `taskBucket()` seam (timeline + list agree); add flow creates exactly one task.
- **PLAN-2** ☑ "··· → Log mood" logs + invalidates stats; nav clearance fixes overlap.
- **PLAN-3** ☑ List groups collapse/expand (`collapsedGroupsProvider`).
- **PLAN-4** ☑ Per-group "+" opens add-task pre-bucketed.
- **PLAN-5** ☑ Add-task tags from `tagsProvider`; saves the correct `tagId`.
- **PLAN-6** ⛔ Quick-add mic → honest "coming soon".
- **PLAN-7** ☑ Repeat returns a `RepeatRule`; recurrence expands onto matching days.
- **PLAN-8** ☑ Quick-add carries title/time/repeat into the full form (`taskDraftProvider`).
- **PLAN-9** ☑ Add-task wrapped in `DismissKeyboard`.
- **PLAN-10** ☑ Subject "None" renders as "None" and clears the link.
- **PLAN-11** ☑ Custom tag created in add-task appears everywhere (`TagsController`).
- **PLAN-12** ☑ "Start session" configures + starts the session and links the task.
- **PLAN-13** ⛔ "Break down more" (AI) → expands existing microtasks now; generation is §8.
- **PLAN-14** ☑ "Move to tomorrow" moves the real task (`DayTasksController.move`).
- **PLAN-15** ☑ Reschedule review is data-driven and moves real tasks (per-task + bulk).

## Subjects / Semesters
- **SUBJ-1** ☑ Add-semester keyboard fixed (canonical sheet).
- **SUBJ-2** ☑ Semester switch persists (`selectedSemesterProvider`); name carries the term (model has no date field).
- **SUBJ-3** ☑ Edit semesters: rename + delete (`SemestersController`, last-semester guard).
- **SUBJ-4** ◐/⛔ Detail Edit opens the form; material file preview is graceful ("coming soon").
- **SUBJ-5** ☑ Subject form saves (create + edit via `SubjectsController`).
- **SUBJ-6** ☑ Missing-file nudge "Add →" navigates to the first subject missing a file; count is dynamic.

## Ada AI
- **ADA-1** ☑ Textbox clears the nav, rises with the keyboard, has an outline.
- **ADA-2** ⛔ Upload → honest "coming soon".
- **ADA-3** ◐ Chat history opens; switching between past conversations needs a conversations model (deferred to §8).
