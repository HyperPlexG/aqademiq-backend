# FRAMES.md — Complete frame inventory (build checklist)

> **88 frames across 11 sections.** This is the authoritative checklist. Claude Code
> MUST build every one and tick it off. A frame is "done" only when it visually
> matches the matching artboard in `prototypes/Aqademiq V1 Full Flow v5.html` AND
> its transitions match `prototypes/Aqademiq User Flow - Comprehensive.html`.
>
> How to read each row: `id` = the artboard id in the prototype (search the HTML for
> `DCArtboard id="<id>"` to find the exact component, e.g. `<PLAN_TIMELINE/>`).
> **Kind:** `route` = a full screen / navigable destination · `sheet` = bottom sheet ·
> `dialog` = centered modal · `menu` = popover/action sheet · `state` = a variant of a
> route (collapsed / scrolled / alternate data), implemented as state on its parent route,
> not a new route.

---

## 00 — Entry & Auth  (5)
- [x] `splash` — Splash — **route** (auto-advances to Welcome)
- [x] `welcome` — Welcome (Jump in / Sign up / Sign in fork) — **route**
- [x] `auth` — Sign in (password) — **route**
- [x] `auth-signup` — Create an account — **route**
- [x] `auth-otp` — OTP verification — **route**

## 00b — Guest Mode  (5)
- [x] `guest-home` — Guest home + setup nudge — **route** (Plan in guest mode)
- [x] `guest-subjects` — Guest Subjects (empty) — **route**
- [x] `guest-ada` — Tap Ada → onboarding prompt — **dialog/state** (gated-feature prompt)
- [x] `guest-stats` — Tap Stats → onboarding prompt — **dialog/state**
- [x] `guest-save` — After session → save-progress prompt — **dialog/state**

## 01 — Onboarding  (9)
- [x] `ob-referral` — Referral code (optional) — **route**
- [x] `ob1` — Step 1: Name — **route**
- [x] `ob2` — Step 2: What you study — **route**
- [x] `ob2-add` — Step 2: Add subject popup — **dialog**
- [x] `ob-mood` — Step 3: Feelings per subject — **route**
- [x] `ob3` — Step 4: Upload syllabus — **route** (GCS upload + async parse)
- [x] `ob4` — Step 5: Peak time + goal — **route**
- [x] `ob5` — Step 6: Meet Prism — **route**
- [x] `adaload` — Ada building your week — **route** (loading/transition)

## 02 — Plan / Home  (22)
- [x] `plan-timeline` — Timeline (default home) — **route**
- [x] `plan-breakdown` — Task → microtasks — **state**
- [x] `plan-list` — List grouping — **state** (group-by toggle)
- [x] `plan-anytime-collapsed` — Anytime collapsed — **state**
- [x] `plan-planned-collapsed` — Planned collapsed — **state**
- [x] `plan-otherday` — Another day + Today button — **state**
- [x] `plan-month` — Month picker (June) — **sheet/menu**
- [x] `plan-month-next` — Month picker → July — **state**
- [x] `plan-monthyear` — Month + year wheel — **sheet**
- [x] `plan-quickadd` — Quick add (+ button) — **sheet**
- [x] `plan-menu` — ··· overflow menu — **menu**
- [x] `plan-grouping` — Grouping submenu — **menu**
- [x] `plan-logmood` — Log mood popup — **sheet/dialog**
- [x] `plan-resched` — Reschedule remaining — **menu/sheet**
- [x] `plan-move` — Reschedule → move date — **sheet**
- [x] `plan-addtask` — Add task (full form) — **route/sheet**
- [x] `plan-pick-time` — Time-of-day picker — **sheet**
- [x] `plan-pick-time-custom` — Specific time dialog — **dialog**
- [x] `plan-pick-date` — Date picker — **sheet**
- [x] `plan-pick-duration` — Duration picker — **sheet**
- [x] `plan-pick-duration-custom` — Custom duration dialog — **dialog**
- [x] `plan-pick-repeat` — Repeat picker — **sheet**
- [x] `plan-pick-repeat-custom` — Custom repeat dialog — **dialog**

## 03 — Subjects  (11)
- [x] `subj-list` — Subjects list (Grid via Tweak) — **route**
- [x] `subj-detail` — Subject detail + files — **route**
- [x] `subj-add` — Add / edit subject — **route/sheet**
- [x] `subj-add-gpa` — Target as GPA — **state**
- [x] `subj-add-pct` — Target as % — **state**
- [x] `subj-file` — Add file to subject — **sheet** (GCS upload)
- [x] `subj-menu` — ··· semester menu — **menu**
- [x] `subj-add-sem` — Add semester — **sheet/dialog**
- [x] `subj-edit-sem` — Edit semesters — **route/sheet**
- [x] `subj-sort` — Sort subjects — **menu/sheet**
- [x] `subj-share` — Share / referral sheet — **sheet**

## 04 — Focus  (7)
- [x] `fc-set` — Set timer — **route**
- [x] `fc-link` — Link a task — **sheet**
- [x] `fc-duration` — Set time dialog — **dialog**
- [x] `fc-prism` — Prism mode picker — **sheet**
- [x] `fc-running` — Running (live melt) — **route** (Redis/Socket.IO-backed)
- [x] `fc-paused` — Paused (frozen) — **state**
- [x] `fc-end` — Session complete — **route/dialog**

## 05 — Ada AI  (3)
- [x] `ada-empty` — Ada intro state — **route**
- [x] `ada-chat` — Active chat — **route** (Claude via Vertex AI, streamed)
- [x] `ada-history` — Chat history — **sheet/route**

## 06 — Profile / Stats  (3)
- [x] `profile-top` — Profile top (streak & mood week) — **route**
- [x] `profile-main` — Profile bottom (hub) — **state** (same route, scrolled)
- [x] `referral` — Referral sheet — **sheet**

## 07 — Mood Check-in  (2)
- [x] `mood-morning` — Morning check-in — **route/sheet**
- [x] `mood-evening` — Evening reflection — **route/sheet**

## 09 — Context & Overflow  (2)
- [x] `task-overflow` — Task action sheet — **sheet**
- [x] `task-swipe` — Swipe actions — **state** (swipe affordance on a task row)

## 13 — Settings  (18)
- [x] `settings-home` — Settings home (profile card, study tags, prefs) — **route**
- [x] `settings-addtag` — Add new tag — **sheet**
- [x] `settings-profile` — Profile (edit personal info) — **route**
- [x] `settings-editname` — Edit name — **sheet**
- [x] `settings-gender` — Gender — **sheet**
- [x] `settings-email-change` — Change email — **sheet**
- [x] `settings-password` — Change password — **sheet**
- [x] `settings-university` — University — **sheet**
- [x] `settings-program` — Program — **sheet**
- [x] `settings-account` — Account & about (scrolled) — **state**
- [x] `settings-delete` — Delete account confirm — **dialog**
- [x] `settings-rate` — Rate Aqademiq — **sheet**
- [x] `settings-notif` — Notifications — **route**
- [x] `settings-notif-sound` — Notification sound — **sheet**
- [x] `settings-notif-more` — Notifications (scrolled) — **state**
- [x] `settings-appearance` — Appearance (Light/Dark/System) — **sheet**
- [x] `settings-sounds` — Prism — **route**
- [x] `settings-email` — Email settings — **route**

---

## Coverage rule
After each section, Claude Code must report: **"Section NN: X/Y frames built, 0 remaining."**
Do not advance to the next section while any box is unchecked. `state` frames don't
need their own route, but their visual must be reproducible by toggling the parent —
demonstrate each one.

**Routes vs. states tally:** ~52 navigable routes/overlays + ~36 state variants = **88 total**.
