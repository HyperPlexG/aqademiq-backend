# INTEGRATION.md — Flutter app ↔ NestJS / Google Cloud backend

> ⚠️ **PLACEHOLDER — fill this in during the backend-wiring pass (README §8).**
> Build the Flutter UI with mock fixtures first (`Env.useMocks=true`, all 88 frames
> in `FRAMES.md`). When the NestJS contract is ready, drop it in `backend_contract/`
> and have Claude Code complete every `TODO`/☐ below.

---

## 0. Backend contract (paste / link here)

- **API:** NestJS (Node/TS) on **Cloud Run** · `TODO` path to `@nestjs/swagger` OpenAPI JSON (`/api-json`)
- **DB:** **Cloud SQL for PostgreSQL** (Enterprise Plus, HA) with **RLS + pgvector** — app talks only to the API, never the DB
- **Auth:** **Identity Platform** (accounts + OAuth) · `TODO` API key / OAuth client IDs / project
- **Realtime:** **Socket.IO on Cloud Run** (session affinity) · `TODO` socket URL + channels
- **Cache/timers:** **Memorystore for Redis** (server-side; via REST + Socket.IO, not direct)
- **Storage:** **Google Cloud Storage** signed-URL uploads · `TODO` upload endpoint(s) + bucket
- **Async:** **Cloud Tasks** + **Eventarc/Pub/Sub** (`TASK_COMPLETED`, `FOCUS_SESSION_STARTED`, …)
- **AI:** Ada = **Claude 3.5 Sonnet via Vertex AI** behind a server endpoint (keys never on device)
- **Base URL / env:** `TODO` (via `--dart-define`; GitHub Actions injects per env — never hardcode)

---

## 1. Auth & session (Identity Platform)

| Need | Call | Status |
|---|---|---|
| Sign up (email) | `TODO` Identity Platform `createUser` | ☐ |
| Verify OTP / email | `TODO` email verification / code | ☐ |
| Sign in | `TODO` `signInWithEmailAndPassword` (store ID token securely) | ☐ |
| OAuth (Google/Apple) | `TODO` provider sign-in | ☐ |
| Guest session | `TODO` `signInAnonymously` | ☐ |
| Link guest → user on "Save progress" | `TODO` `linkWithCredential` | ☐ |
| ID-token Dio interceptor + refresh on 401 | `TODO` | ☐ |

---

## 2. Screen → endpoint map

One row per data action. `Provider` = the Riverpod provider that owns it. `socket:` = a Socket.IO event.

| Screen (FRAMES id) | Action | REST / socket | Request | Response | Provider | Status |
|---|---|---|---|---|---|---|
| `plan-timeline` | Load a day's tasks | `TODO GET /tasks?date=` | `date` | `TaskDto[]` | `dayTasksProvider(date)` | ☐ |
| `plan-addtask` | Create task | `TODO POST /tasks` | `TaskInput` | `TaskDto` | invalidate `dayTasksProvider` | ☐ |
| `plan-timeline` (toggle) | Complete/uncomplete | `TODO PATCH /tasks/:id` | `{done}` | `TaskDto` | optimistic; emits `TASK_COMPLETED` | ☐ |
| `plan-resched`/`plan-move` | Update task date | `TODO PATCH /tasks/:id` | `{date}` | | | ☐ |
| `plan-breakdown` | Ada microtasks | `TODO POST /tasks/:id/breakdown` | | `Subtask[]` | Vertex AI server-side | ☐ |
| `subj-list` | Load subjects | `TODO GET /subjects` | | `SubjectDto[]` | `subjectsProvider` | ☐ |
| `subj-add` | Create/update subject | `TODO POST·PATCH /subjects` | `SubjectInput` | `SubjectDto` | | ☐ |
| `subj-file` | Signed GCS upload | `TODO POST /uploads/sign` → GCS `PUT` | `{name,type}` | `{url,key}` | | ☐ |
| `fc-set`/`fc-running` | Start session | `TODO POST /focus-sessions` + `socket join` | `{durationMin,taskId,prism}` | `FocusSessionDto` | Redis-backed; `FOCUS_SESSION_STARTED` | ☐ |
| `fc-running` | Live tick | `socket: focus:tick` | | `{elapsed,progress}` | `focusSessionProvider` | ☐ |
| `fc-end` | Complete | `TODO POST /focus-sessions/:id/complete` | `{mood?}` | | | ☐ |
| `ada-chat` | Send message | `TODO POST /ada/messages` (stream) | `{message,context}` | streamed reply | `adaChatProvider` | ☐ |
| `ob2` | Bulk save subjects | `TODO POST /subjects/bulk` | `SubjectInput[]` | | | ☐ |
| `ob3` | Upload + parse syllabus | `TODO` sign→GCS→async parse (Cloud Tasks) | file | `TaskDto[]` (later) | "processing…" | ☐ |
| `mood-morning`/`mood-evening` | Log mood | `TODO POST /mood-logs` | `MoodLog` | | `moodProvider` | ☐ |
| `profile-top` | Load stats | `TODO GET /me/stats` | | `StatsDto` | `statsProvider` | ☐ |
| `settings-profile` | Update profile | `TODO PATCH /me` | `ProfileInput` | `ProfileDto` | `meProvider` | ☐ |
| `settings-home` (tags) | CRUD study tags | `TODO /tags` | `TagInput` | `TagDto[]` | `tagsProvider` | ☐ |
| `settings-notif` | Get/set prefs | `TODO /me/notification-prefs` | | | | ☐ |
| `settings-email`/`settings-appearance` | Update prefs | `TODO PATCH /me/prefs` | | | | ☐ |

---

## 3. Shared models (mock now → freezed/codegen later)

Define **UI models** in `data/models` (used by widgets); keep raw API **DTOs** in
`data/dtos` separate; map DTO→model in `data/adapters` (README §7 seam 2). Generate
DTOs with `freezed` + `json_serializable` from the OpenAPI spec during wiring — the
UI models + adapters absorb any differences.

```dart
// data/models/task.dart — the UI model widgets use (mock-stable)
@freezed
class Task with _$Task {
  const factory Task({
    required String id,
    required String title,
    required String tag,                 // TagId
    required DateTime date,
    String? timeOfDay,                   // morning|afternoon|evening|anytime
    DateTime? startTime,
    int? durationMin,
    RepeatRule? repeat,
    @Default(<Subtask>[]) List<Subtask> subtasks,
    @Default(false) bool done,
  }) = _Task;
}

@freezed class Subject with _$Subject { const factory Subject({ required String id, required String name, required String color, SubjectTarget? target, required String semesterId }) = _Subject; }
@freezed class FocusSession with _$FocusSession { const factory FocusSession({ required String id, String? taskId, required int durationMin, String? prismMode, DateTime? completedAt }) = _FocusSession; }
@freezed class MoodLog with _$MoodLog { const factory MoodLog({ required String id, required DateTime date, required String phase, required int mood, String? note }) = _MoodLog; }
@freezed class Tag with _$Tag { const factory Tag({ required String id, required String label, required String color }) = _Tag; }
@freezed class AppUser with _$AppUser { const factory AppUser({ required String id, required String name, String? email, String? university, String? program, @Default(false) bool isGuest }) = _AppUser; }
```

---

## 4. Cross-cutting (apply to every call)

- ☐ Loading / empty / error via `AsyncValue.when` (built in §7 — not deferred)
- ☐ Optimistic updates (task toggle, mood log)
- ☐ Offline cache + retry — **important for Guest Mode**
- ☐ "processing…" states for async Cloud Tasks/AI flows (syllabus parse, Ada reply)
- ☐ Streaming typing state for Ada (Vertex AI)
- ☐ No Dio/DTO inside widgets — all calls go through `data/sources` + repositories
- ☐ Env-only config (`--dart-define`); only the Identity Platform ID token travels with requests

---

*When this file has no remaining `TODO`/`☐`, the integration pass is complete.*
