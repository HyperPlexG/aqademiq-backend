# Frontend Integration Plan — wiring the Flutter app to the live backend

This is the executable spec for the "§8 wiring pass": connecting the Flutter app
(currently mock-only) to the NestJS API. It must be done from a machine with the
**Flutter SDK** and against a **deployed backend** (build-verify + run each flow) —
it cannot be completed blind. Everything here is scoped so it's a well-defined task,
not open-ended discovery.

## Status — the wiring pass is now IMPLEMENTED in-repo (needs your analyze + test)
All of the following were written against the real backend contract. Because this
repo has no Flutter SDK, none of it has been compiled or run — **your first job is
to compile it and drive each flow against a live backend.**

- ✅ Secure token storage — `lib/data/auth/token_store.dart`.
- ✅ Bearer + refresh-on-401 interceptor — `lib/core/network/auth_interceptor.dart` (wired into `dio_client.dart`).
- ✅ Live auth — `lib/data/auth/api_auth_repository.dart` (guest/signin/signup/verify-otp/link/signout/change-password); provider switches on `Env.useMocks`. Interface unchanged, so no screen edits.
- ✅ All 7 data sources implemented: `ApiTasksSource`, `ApiSubjectsSource`, `ApiTagsSource`, `ApiMoodSource`, `ApiFocusSource`, `ApiProfileSource`, `ApiAdaSource` (in `lib/data/sources/*`).
- ✅ Change-password sheet wired end-to-end (`settings-password`).

First step on your machine:
```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze     # fix any compile errors first (paste them back if you want help)
```

### Known runtime risks to test first (mapping bugs analyze won't catch)
- **Tasks `tagId` ↔ backend `category`**: the app tags tasks; the backend links them to a subject + `task_type`. The source bridges `tagId`↔`category`, so the tag chip may not resolve to a StudyTag. Revisit if the plan screen's tag colors look wrong.
- **Task create needs a subject**: `POST /tasks` 422s if the user has no subject yet (backend falls back to "first subject"). Ensure onboarding creates one.
- **Subject `color` must be `#RRGGBB`** (no alpha) or `POST /subjects` 422s.
- **Cold-launch restore**: `_restore()` hydrates from `/profile`, which returns no user `id` — the restored `AppUser.id` is empty until the next auth call. UI gates on `isGuest`, not `id`, so this is usually fine; if you need the id at rest, decode it from the JWT `sub`.
- **Stats "this week"**: `/me/stats` returns lifetime totals; surfaced in the weekly fields as a first pass.

## The two structural mismatches (now handled inside the Api sources)

## The two structural mismatches you must resolve

### Mismatch A — DTO shape: the Dart DTOs describe the **mock fixtures**, not the backend
`lib/data/dtos/*` were authored against `data/fixtures`, and their generated
`fromJson`/`toJson` use **camelCase** keys that do not match the backend's snake_case
responses. Example (tasks):

| Dart `TaskDto` (json key) | Backend occurrence DTO (json key) | Note |
|---|---|---|
| `tagId` | `subject_id` + `category` | Dart models a "tag"; backend has subject/course + task_type |
| `date` | *(none — the occurrence date is the query/occurrence-id)* | must be supplied by the source from the request context |
| `timeOfDay`, `startTime` | `scheduled_at` (a `HH:mm` string) | |
| `durationMin` | `duration_seconds` | unit change |
| `repeat.frequency` | `repeat.kind` | + `repeat.interval` matches |
| `subtasks[{id,title,done}]` | `steps[{id,title,duration_seconds,status}]` | rename + `done`↔`status` COMPLETE/PENDING |
| `done` (bool) | `status` ("COMPLETE"/"PENDING") | |

Subjects have the same problem (`SubjectDto.semesterId/targetGrade/focusHours/fileCount`
vs backend `dto()` fields; create uses `color_hex`, `prof`, `term_id`, …).

**Recommended fix (preserves the UI models + widgets):** do the mapping **inside each
`Api*Source`** — hand-build the existing `*Dto` from the backend JSON (and hand-build the
request body from the incoming `*Dto`), rather than calling `*Dto.fromJson`. The
repository → adapter → UI-model layer above the source stays untouched, so no widget
changes. (Alternative: regenerate the DTOs from `openapi.json` and rewrite the adapters —
larger blast radius; only do this if you'd rather the DTOs mirror the API 1:1.)

### Mismatch B — `AuthRepository` is Firebase-shaped, the backend is an OTP flow
`lib/data/auth/auth_repository.dart` models `signUp()` as returning a user
immediately (Firebase `createUser`). The backend is:
`signup → {pending_verification}` → `verify-otp(email, code) → {tokens, user}`.
`verifyOtp(code)` also lacks the email it needs. You must refactor the interface + its
callers (`signup_screen`, `otp_screen`, `auth_controller`) to carry the email between
steps and to treat signup as "pending until OTP".

## Step 1 — Live `ApiAuthRepository`
Create `lib/data/auth/api_auth_repository.dart` implementing `AuthRepository` against
these endpoints (all under `/v1`, snake_case; contract is stable — see
`src/features/auth/auth.controller.ts`). On any call that returns a token pair, persist
it via `TokenStore.save(access, refresh)`; on sign-out call `TokenStore.clear()` +
`POST /auth/signout`.

| Interface method | Endpoint | Request | Response → AppUser |
|---|---|---|---|
| `signInAnonymously()` | `POST /auth/guest` | — | `{access_token, refresh_token, user{id,email,is_guest}}` |
| `signInWithEmail(email,pw)` | `POST /auth/signin` | `{email,password}` | tokens + user |
| `signUp(name,email,pw)` | `POST /auth/signup` | `{email,password,name}` | `{status:"pending_verification"}` → **no tokens yet** |
| `verifyOtp(email,code)` (new sig) | `POST /auth/verify-otp` | `{email,code}` | tokens + user |
| `linkGuestToAccount(email,pw)` | `POST /auth/link-guest` (Bearer guest token) | `{email,password}` | `{status:"pending_verification"}` → then verify-otp |
| `signOut()` | `POST /auth/signout` | — | clear tokens |

Then flip the provider:
```dart
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (Env.useMocks) { /* existing MockAuthRepository */ }
  return ApiAuthRepository(ref.watch(dioProvider), ref.watch(tokenStoreProvider));
});
```
Bootstrap `authState()` from `TokenStore.hasSession` on launch (call `GET /profile` to
hydrate the current user), so a returning user stays signed in.

## Step 2 — Feature data sources (7)
Implement each `Api*Source` (in `lib/data/sources/*`) by mapping to the backend. Use
the mock source in the same file as the behavioral reference; use the backend service
as the shape reference. Endpoints:

| Source | Backend endpoints | Key mapping notes |
|---|---|---|
| `ApiTasksSource` | `GET /tasks?date=` / `?from=&to=`, `POST /tasks`, `PATCH /tasks/:occ`, `PATCH /tasks/:occ/toggle`, `DELETE /tasks/:occ`, `POST /tasks/move` | see Mismatch A table; `date` comes from the request, not the response |
| `ApiSubjectsSource` | `GET/POST /subjects`, `PATCH/DELETE /subjects/:id`, `POST /subjects/reorder`, `GET /semesters` | `color`→`color_hex`, `professor`→`prof`, `semesterId`→`term_id`; target GPA/% ↔ `target_grade` |
| `ApiMoodSource` | `POST /mood-entries`, `GET /mood-entries/today|/week|/:date`, `POST /mood-entries/:date/reflection` | `mood_index` is 0–4 on the wire; backend stores 1–5 (`mood_score-1`) |
| `ApiFocusSource` | `POST /focus-sessions`, `PATCH /focus-sessions/:id`, `POST /focus-sessions/:id/complete` | status enum is UPPERCASE on the wire (RUNNING/PAUSED/COMPLETE); `prism_mode` accepts a mode key (`rain`) |
| `ApiAdaSource` | `POST/GET /ada/conversations`, `GET/POST /ada/conversations/:id/messages`, `.../apply-plan`, `POST /ada/uploads` | messages return `{messages:[{role,content,...}]}`; upload is presign-then-reference |
| `ApiTagsSource` | `GET/POST /study-tags`, `DELETE /study-tags/:label` | closest 1:1 — `{id,label,color}` |
| `ApiProfileSource` | `GET /profile`, `PATCH /profile`, `GET /me/stats`, `GET /streaks/current` | stats aggregate lives at `/me/stats` |

For each: map response JSON → the existing `*Dto` (hand-built), and `*Dto` → request
body. Wrap Dio errors into the app's `Failure` type (`lib/core/error/failure.dart`) so
the existing `AsyncValue.when` error UI works.

## Step 3 — Realtime (optional for v1)
`socket_io_client` is already a dependency. Connect to `<SOCKET_URL>/me/revisions` with
`auth: {token: <access>}` and invalidate the relevant Riverpod providers on each
`revision` event (see `src/features/realtime/revisions.gateway.ts`). Falls back to
pull-to-refresh if you skip it for launch.

## Step 4 — The "coming soon" buttons
- ✅ **Change password** — wired (`password_sheet.dart` → `AuthController.changePassword` → `POST /auth/change-password`).
- ☐ **Forgot password** (`signin_screen.dart`) → needs 3 small screens (email → OTP → new password) over `POST /auth/forgot-password` → `/forgot-password/verify` → `/forgot-password/reset`. Deferred (new UI).
- ☐ **Ada attach document** (`ada_screen.dart`) → needs a file picker dependency (`file_picker`/`image_picker`, + native config), then `POST /ada/uploads` and reference the returned `key` in the next message. Deferred (new dep).
- ☐ **Subject file preview** (`subject_detail_screen.dart`) → `GET /files/:id/download` → `launchUrl` (url_launcher is already a dep). Small, but needs a files Dio call added. Deferred.
- ☐ Voice capture (`quick_add_sheet.dart`) — no backend; leave deferred or add on-device speech-to-text.

## Step 5 — Verify each flow end-to-end
Against the deployed backend (`--dart-define=USE_MOCKS=false --dart-define=API_BASE_URL=...`),
walk the §2 smoke test in `docs/PENTEST_TESTING_GUIDE.md`: guest → signup/OTP → tasks
CRUD + recurrence → mood/focus → sync → sign-out/refresh. A green mock run is **not**
evidence the API path works — exercise the real one. Runtime field-mapping bugs won't
show up in `flutter analyze`; only running the flows will surface them.
```
