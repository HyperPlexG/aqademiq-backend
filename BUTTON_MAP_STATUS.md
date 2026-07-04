# Button Map → Backend Coverage Report

**Source:** `reference_docs/frontend_requests/Aqademiq_Button_Map.html` (88 screens, 11 sections, v5 design canvas — buttons aren't click-wired in the frontend yet, this maps *intended* navigation to backend capability).
**Backend as of:** current `prisma/schema.prisma` (old paradigm, Phase 1 of `SCHEMA_GAP_REPORT.md` applied) + `src/features/*`.
**Companion doc:** `BUTTON_MAP_SCHEMA_GAPS.md` — the handful of things the button map needs that `schema.md` doesn't (yet) model. Everything else below is either done, or a wiring gap the target schema already accounts for.

**Update (2026-07-01):** every ❌ item below except Prism preset persistence has been implemented — see `reference_docs/changes_summary/phase2_button_map_gaps.md` for the full write-up. Rows are annotated `[DONE 2026-07-01]` where this applies; the original gap analysis is left in place underneath so the "why" isn't lost.

**Update (2026-07-02):** all remaining 🟡 items except Prism (explicitly deferred) are now implemented and E2E-tested (14/14):
- **Referral attribution + reward ledger** — `ReferralRedemption` table (one redemption per invitee, unique); `POST /referrals/redeem` persists + credits; `GET /referrals/rewards/balance` returns real `balance`/`redemptions`; `POST /onboarding/complete` now redeems `referral_code` (best-effort — invalid code reports `referral:'invalid'` without failing onboarding).
- **Share-channel tracking** — `ShareEvent` table + `POST /v1/share-events` `{kind: referral|subject, channel, subject_id?}`.
- **Task-due reminders + reschedule correctness** — new `task_due` channel in the reminder sweep, matched at fire-time against freshly materialized occurrences (occursOn + overrides, honors `notification-channels` opt-out, dedups on `{user}:task_due:{occ}`); because matching is fire-time, moves/deletes/completions need no job cancellation — the old `// TODO §4.5` in `tasks.move()` is resolved by design.
- **Task-swipe snooze** — first-class `POST /v1/tasks/:occ/snooze[?days=N]` (MOVED override to the next day, relative to the occurrence's effective date).
- **ob4 peak_time** — `user_profiles.peak_time` enum-validated (`morning|afternoon|evening|night`), accepted by both `POST /onboarding/complete` and `PATCH /profile`, returned by `GET /profile`.
- **Migration hygiene:** the 2026-07-01 schema changes had no committed migration (drift). Two migrations added: `20260702000001_phase1_auth_paradigm_catchup` (catches migrations up to the July-1 schema) and `20260702000002_referral_ledger_share_events_peak_time` (this pass). `prisma migrate diff` DB↔schema is now empty.

Legend: ✅ satisfied · 🟡 partial (endpoint exists, behavior incomplete) · ❌ missing (no route, or route is a stub).

---

## 00 — Entry

| Screen(s) | Buttons | Status | Notes |
|---|---|---|---|
| splash, welcome | auto-advance, fork to auth/guest | ✅ (client-only) | No backend involved. |
| auth (sign in) | Sign in → | ✅ | `POST /v1/auth/signin` |
| auth | Sign in with Apple | ✅ `[DONE 2026-07-01]` | `POST /v1/auth/sso/apple` now verifies the identity token against Apple's live JWKS and finds-or-creates the user. Requires `APPLE_OAUTH_CLIENT_IDS` in `.env`. *(Was: stub — `ssoApple()` threw/returned nothing, no Apple JWKS verification.)* |
| auth | Sign in with Google | ✅ `[DONE 2026-07-01]` | `POST /v1/auth/sso/google` — same, now real, via `GOOGLE_OAUTH_CLIENT_IDS`. *(Was: stub.)* |
| auth | Forgot password? | ✅ (ahead of frontend) | Button map's own footnote calls this "not in prototype," but the backend already has a full flow: `POST /v1/auth/forgot-password` → `/forgot-password/verify` → `/forgot-password/reset`. Frontend just needs to wire it. |
| auth-signup | Create account → | ✅ | `POST /v1/auth/signup` |
| auth-otp | Verify →, Resend code | ✅ | `POST /v1/auth/verify-otp`, `POST /v1/auth/resend-otp` |

**How to implement the gap (done):** Apple/Google sign-in now do real JWKS verification in `auth.service.ts` (`ssoApple`/`ssoGoogle`), each producing/looking up an `auth_identities` row keyed by `(provider, provider_subject)`.

---

## 00b — Guest Mode

| Screen(s) | Status | Notes |
|---|---|---|
| guest-home, guest-subjects, guest-ada, guest-stats, guest-save | ✅ | All client-side gating on `user.is_guest` (returned by `POST /v1/auth/guest`, `GET /v1/profile`). The lock prompts, "Finish setup" nudges, and the post-session "Create account & save" screen route to real endpoints: `POST /v1/onboarding/complete`, `POST /v1/auth/link-guest`, `POST /v1/auth/signup`. |

No backend work needed here — it's all conditional rendering on a flag the backend already returns.

---

## 01 — Onboarding

| Screen | Status | Notes |
|---|---|---|
| ob-referral (referral code entry) | 🟡 | `CompleteOnboardingDto.referral_code` is accepted but **`onboarding.service.ts` never uses it** — the code comment says attribution is "deferred to the referrals feature." Nothing calls `referrals.redeem()` from onboarding. |
| ob1 (name) | ✅ | `dto.name` → `UserProfile.name` |
| ob2 (subjects), ob2-add | ✅ | `dto.subjects[]` → creates `Subject` rows in the transaction |
| ob-mood (feelings per subject) | ✅ | `dto.subjects[].mood` (0–4 int; target schema renames/rescales this to `subject_feeling` 1–5, tracked in `SCHEMA_GAP_REPORT.md` §3.7 — not a frontend blocker) |
| ob3 (upload syllabus) | ✅ `[DONE 2026-07-01]` | `POST /uploads/staging/init` (no subject required yet) + `syllabus_staging_key`/`syllabus_file_name`/`syllabus_mime_type` on each `OnboardingSubjectDto` entry — `OnboardingService.complete()` attaches the `SubjectFile` once the subject exists in the same transaction. *(Was: no wiring — `POST /uploads/init` required a subject_id the wizard didn't have yet.)* |
| ob4 (peak time + goal) | 🟡 (unchanged — not in this pass) | `daily_focus_goal_min`, `education_level`, `work_best_times` are accepted and persisted to `SettingsPrefs`. There's no explicit "peak_time" enum field yet in the current schema (target schema adds `user_profiles.peak_time` — Phase 2, not done); `work_best_times` (freeform JSON) is the closest current stand-in. |
| ob5 (meet Prism) | ❌ (unchanged — explicitly out of scope) | No onboarding step persists a chosen Prism preset — `prism.service.ts` only returns a static catalog, nothing writes a per-user default. Deferred per instruction; see `BUTTON_MAP_SCHEMA_GAPS.md`. |
| adaload (Ada auto-builds plan) | ✅ `[DONE 2026-07-01]` | `POST /v1/ada/plan-week` now generates and applies a real week plan grounded in the user's subjects + existing tasks, through the same §4.3 validation gate as chat. Frontend should call it right after `/onboarding/complete` while showing the `adaload` spinner. *(Was: stub — `// TODO(§2.5): trigger the initial Ada plan... once Vertex AI is wired`.)* |

**How to implement (referral attribution, ob4 peak_time, and Prism remain open — unchanged from the original analysis):**
1. **Referral attribution:** in `OnboardingService.complete()`, if `dto.referral_code` is present, call `ReferralsService.redeem()` (or inline the same lookup) inside the same transaction before returning. Requires the code-generation path already in `referrals.service.ts::ensureCode()`.
2. **Prism preset selection:** needs the target schema's `prism_audio_profiles` table (see `BUTTON_MAP_SCHEMA_GAPS.md` — currently entirely absent). Once added, accept `prism_preset_id` in the onboarding DTO and upsert it. *(Explicitly deferred — not part of this pass.)*

---

## 02 — Plan / Home

| Screen(s) | Status | Notes |
|---|---|---|
| plan-timeline, plan-list, plan-anytime-collapsed, plan-planned-collapsed, plan-otherday | ✅ | `GET /v1/tasks?date=`/`?from=&to=` (occurrence-materialized query). Timeline vs. List is a client-side grouping choice on the same data. |
| plan-month, plan-month-next, plan-monthyear | ✅ (client-only) | Pure date picker UI; backed by the same `GET /v1/tasks` range query. |
| plan-quickadd, plan-addtask + all its pickers (time/date/duration/repeat, incl. custom variants) | ✅ | `POST /v1/tasks` — `CreateTaskDto` covers `scheduled_at`, `date`, `duration_seconds`, `repeat.{kind,interval}`, `until_date`. |
| plan-menu, plan-grouping | ✅ (client-only) | Grouping toggle; no backend call. |
| plan-logmood | ✅ | `POST /v1/mood-entries` |
| plan-resched, plan-move | 🟡 | `POST /v1/tasks/move` moves occurrences for a given `from`→`to` date (optionally a specific id list). It does **not** yet cancel pending reminders for the moved occurrences — there's a `// TODO §4.5 cancel reminders` in the service. Functionally the screen works; reminder correctness is the gap. |
| plan-breakdown (task → microtasks, "Start a microtask") | 🟡 | `POST /v1/tasks/:occ/breakdown` creates `TaskStep` rows (title/order/status) via Claude Haiku or a regex fallback — the breakdown itself works. But "Start a microtask" implies starting a **focus session scoped to one microtask**, and `focus_sessions.task_id` can only reference a task/occurrence, not an individual `TaskStep`. See `BUTTON_MAP_SCHEMA_GAPS.md`. |
| task-overflow (start focus / break into microtasks / reschedule / edit / delete) | ✅ | Each action maps 1:1 to an existing route (`focus-sessions` start, `breakdown`, `move`, `patch`, `remove`). |
| task-swipe (done / snooze / delete) | 🟡 | Done → `PATCH /v1/tasks/:occ/toggle` ✅. Delete → `DELETE /v1/tasks/:occ` ✅. "Snooze" has no dedicated endpoint or status value — it'd need to be implemented client-side as "move this occurrence to tomorrow" via the existing `move` endpoint (functionally fine, just not a first-class concept server-side). |

**How to implement the reschedule reminder gap:** in `TasksService.move()`, after updating occurrence overrides, enqueue a reminder-cancel job (or directly delete/re-schedule the BullMQ job keyed by occurrence id) via `QueueService`, mirroring whatever enqueues reminders on create.

---

## 03 — Subjects

| Screen(s) | Status | Notes |
|---|---|---|
| subj-list, subj-detail, subj-add (+ gpa/pct variants), subj-file, subj-menu, subj-add-sem, subj-edit-sem | ✅ | Full CRUD: `GET/POST/PATCH/DELETE /v1/subjects`, `GET/POST/PATCH/DELETE /v1/semesters`, `POST /v1/subjects/:id/files`. GPA vs. percentage target toggle is client-side over the single `target_grade` string field today (target schema splits this into `grade_system` + `target_gpa`/`target_percentage`/`target_grade_text` — Phase 3, not yet migrated, but the current field is a usable stand-in). |
| subj-sort | ✅ `[DONE 2026-07-01]` | `Subject.sort_order` added; `PATCH /v1/subjects/reorder` (`{ids: [...]}`) re-numbers it, `list()` orders by it, new subjects append at the end. *(Was: no sort/order field or endpoint at all.)* |
| subj-share | 🟡 (unchanged — not in this pass) | Reuses the referral code (`GET /v1/referrals/rewards/balance` returns the user's shareable code), but there's no endpoint to record *which channel* a share happened through, and no subject-specific share concept — it's really just "share your referral code," which works, but loosely. |

**How to implement (share tracking remains open):**
1. **Share tracking:** requires `share_events` (present in target schema, absent today — see `BUTTON_MAP_SCHEMA_GAPS.md`).

---

## 04 — Focus

| Screen(s) | Status | Notes |
|---|---|---|
| fc-set, fc-link, fc-duration | ✅ | `StartFocusDto.task_id`/`task_date` link a task occurrence; duration is `planned_min`. |
| fc-running, fc-paused | ✅ | `PATCH /v1/focus-sessions/:id` (`CheckpointFocusDto.status: 'RUNNING'|'PAUSED'`) covers pause/resume; no separate endpoints needed. |
| fc-end | ✅ | `POST /v1/focus-sessions/:id/complete` — syncs the linked task to done. |
| fc-prism (mode picker) | 🟡 (unchanged — explicitly deferred) | `GET /v1/prism-modes` returns a static catalog (4 modes + "No sound"), and `StartFocusDto.prism_mode` accepts a free string — so a session *can* record which mode played. What's missing is a **persisted per-user default** (so the picker can pre-select "your usual mode" instead of always starting blank) — that needs `prism_audio_profiles` (target schema, not yet built). |

Overall Focus is in good shape; only the persisted-default-preset piece is missing, and it's optional polish rather than a blocker. (Prism work was explicitly excluded from the 2026-07-01 implementation pass.)

---

## 05 — Ada AI

| Screen(s) | Status | Notes |
|---|---|---|
| ada-empty, ada-chat, ada-history | ✅ | `POST/GET /v1/ada/conversations`, `GET /v1/ada/conversations/:id/messages`, `POST /v1/ada/conversations/:id/messages` (Claude call with a fallback path when Vertex isn't configured — functions either way). |
| "New chat" / chat clear | ✅ | `POST /v1/ada/chat/clear` archives active conversations. |
| Apply a suggested plan | ✅ | `POST /v1/ada/conversations/:cid/messages/:mid/apply-plan` — reads the plan JSON blob off the message and creates tasks (works today; target schema's `ada_generated_plan_items` — Phase 8 — would make per-item accept/reject possible, which the current blob can't do). |
| Attach a file to Ada chat | ✅ `[DONE 2026-07-01]` | `POST /v1/ada/uploads` presigns a GCS upload scoped to the conversation; the client then references `{key, name}` in `attachments` on its next `POST .../messages` call, persisted on `AdaMessage.attachments` (new column). *(Was: stub — `TODO §4.4: requires GCS storage pipeline`.)* |
| Ada auto-generates a weekly plan (used by `adaload`) | ✅ `[DONE 2026-07-01]` | `POST /v1/ada/plan-week` — see the Onboarding section above; same endpoint serves both the onboarding auto-plan and an on-demand "plan my week" from the Ada tab. *(Was: stub — `TODO §2.5 P1: requires Vertex AI Opus`.)* |

Both were wired using pieces already scaffolded elsewhere in the codebase — `StorageService` (GCS presigned URLs, already used by the `files` feature) for uploads, and `ClaudeService` (already used by `ada.service.ts::postMessage` and `tasks.service.ts::breakdown`) for plan generation, extended with a forced `tool_choice` for reliability. Full write-up: `reference_docs/changes_summary/phase2_button_map_gaps.md`.

---

## 06 — Profile

| Screen(s) | Status | Notes |
|---|---|---|
| profile-top, profile-main | ✅ | `GET /v1/profile`, `GET /v1/streaks/current`, `GET /v1/mood-entries/today`, `GET /v1/me/stats` (aggregated streak/tasks/focus/subjects). |
| referral (share sheet) | 🟡 | Same as subj-share above — `GET /v1/referrals/rewards/balance` returns the code, but `balance`/`redemptions` are hardcoded to `0` because `POST /v1/referrals/redeem` doesn't yet persist a `ReferralRedemption` row or credit anything (`// TODO §2.10 P2`). The sheet renders and copies a real code; the reward number underneath it is always zero. |

**How to implement:** in `ReferralsService.redeem()`, replace the TODO with an actual `prisma.referralRedemption.create(...)` (needs the table — see companion doc) and a reward-ledger increment on the referrer.

---

## 07 — Mood Check-in

| Screen(s) | Status | Notes |
|---|---|---|
| mood-morning, mood-evening | ✅ | `POST /v1/mood-entries` (intention/mood), `POST /v1/mood-entries/:date/reflection` (evening reflection). `GET /v1/mood-entries/today` tells the client which of the two still needs completing. |

Fully satisfied.

---

## 09 — Context & Overflow

Covered above under Plan/Home (`task-overflow`, `task-swipe`) — both effectively satisfied, with the snooze caveat noted there.

---

## 13 — Settings

| Screen(s) | Status | Notes |
|---|---|---|
| settings-home | ✅ | Aggregation screen, no dedicated endpoint needed — client composes it from the sub-screens' data. |
| settings-profile, settings-editname, settings-gender, settings-university, settings-program | ✅ | `PATCH /v1/profile` covers `name`, `gender`, `date_of_birth`, `university`, `program`. |
| settings-password | ✅ | `POST /v1/auth/change-password` |
| settings-email-change | ✅ `[DONE 2026-07-01]` | `POST /v1/auth/change-email/request` + `POST /v1/auth/change-email/verify` — OTP sent to the *new* email, then `User.email` and the matching `AuthIdentity` are updated together. Straight copy of the `forgotPassword`/`forgotVerify` pattern. *(Was: no endpoint changed a verified email.)* |
| settings-addtag, settings-account (delete), settings-rate | ✅ | `POST /v1/study-tags`, `DELETE /v1/auth/account` (soft delete + grace period), `POST /ratings`. |
| settings-notif, settings-notif-sound, settings-notif-more | ✅ | `GET/PATCH /v1/me/notification-preferences`, `GET/PUT /v1/me/notification-channels`. |
| settings-appearance | ✅ | `GET/PATCH /v1/me/settings` (`theme_mode: light/dark/system`). |
| settings-sounds (Prism) | 🟡 (unchanged — explicitly deferred) | Same gap as `fc-prism` above — catalog exists, no persisted per-user selection. |
| settings-email (opt-in prefs, distinct from settings-email-change) | ✅ | `GET/PATCH /v1/me/email-preferences`. |

---

## Cross-cutting: what's genuinely solid

Auth (session lifecycle, guest→registered linking, sign-out/revoke, **now also Apple/Google SSO and email change**), Subjects/Semesters CRUD (**now with sort order**), Tasks CRUD + recurrence + breakdown, Focus sessions, Mood check-ins, Study tags, Settings/notification preferences, Streaks, and Ada (**now with file attachments and a real weekly auto-plan**) are all real, working implementations today — not stubs. The button map's primary flow (splash → onboarding → home → task creation → focus → mood) is backed end-to-end, and as of 2026-07-01 so is onboarding's syllabus upload step and its Ada-generated first plan.

What's left, in full (updated 2026-07-02):
- ~~Referral attribution + reward ledger~~ — **done 2026-07-02**
- ~~Subject/referral share-channel tracking~~ — **done 2026-07-02** (`share_events` + `POST /v1/share-events`)
- ~~Reschedule reminder cancellation~~ / ~~task-swipe snooze~~ — **done 2026-07-02** (sweep-based `task_due` reminders + `POST /tasks/:occ/snooze`)
- ~~ob4 peak_time~~ — **done 2026-07-02** (`user_profiles.peak_time`)
- **Prism per-user preference persistence** (❌ — still explicitly deferred; needs `prism_audio_profiles`, see `BUTTON_MAP_SCHEMA_GAPS.md`)

Only Prism remains, and it's explicitly deferred. Full detail on the 2026-07-01 pass: `reference_docs/changes_summary/phase2_button_map_gaps.md`.

## Priority if picking a build order (updated 2026-07-02)

1. ~~Apple/Google sign-in~~ — done
2. ~~Email change flow~~ — done
3. ~~Ada plan-week + syllabus/file uploads~~ — done
4. ~~Subject sort~~ — done
5. ~~Referral attribution + reward ledger~~ — done
6. Prism per-user preference (explicitly deferred — pick up whenever Prism work resumes)
7. ~~Share-channel tracking (`share_events`)~~ — done
