# Aqademiq — Frontend Integration Contract

> **This document is the authoritative human contract for wiring the Flutter
> client to the Aqademiq backend.** Where this `.md` and
> `backend_contract/openapi.json` disagree, **this `.md` wins** — discrepancies
> are flagged inline with **⚠️ SPEC DRIFT**.
>
> Everything here is grounded in the actual NestJS controllers, `dto/*.dto.ts`,
> feature services, and `prisma/schema.prisma` as of 2026-07-04.
>
> Legend for every endpoint:
> - **Auth:** `public` (no token) · `bearer` (access token required) ·
>   `bearer (guest-ok)` (works for guest users too — which is *all* bearer
>   endpoints unless noted).
> - **State:** ✅ implemented · 🟡 partial · ⛔ **NOT IMPLEMENTED YET** (stub —
>   mock on the client until it lands).

---

## 0. OpenAPI spec status (`backend_contract/openapi.json`)

The spec was freshly emitted (`EMIT_OPENAPI=1 npm run start:dev`) on 2026-07-04
and committed. It contains **all live routes** including the newest
`auth/change-email/*`, `uploads/staging/init`, and `debug/sql-smoke-test`.

**Use the spec for DTO/request codegen, but read this `.md` for response shapes
and behavior.** The emitted spec has three structural limitations you must know:

1. **Response bodies are undocumented in the spec** (`"responses": {"200": {"description": ""}}`
   with no schema). NestJS controllers return plain objects with no
   `@ApiResponse` decorators, so success shapes exist **only in this document**.
2. **Query params show `"required": true` even when optional.** The controllers
   read query params without validation decorators, so Swagger can't tell they're
   optional. In reality `semester_id`, `date`, `field`, `since`, `from`, `to`,
   `force` are all **optional**. This `.md` marks the true optionality.
3. **A few request bodies are missing from the spec** because their handlers have
   no typed `@Body()` DTO: `auth/sso/apple`, `auth/sso/google`,
   `auth/change-email/*`, `ada/uploads`, `ada/plan-week`, `subjects/:id/files`,
   `subjects/reorder`, `uploads/staging/init`. Their real bodies are documented
   here.

---

## 1. Environments & base URLs

| Env | REST base URL | WebSocket URL |
|---|---|---|
| Local dev | `http://localhost:8080/v1` | `ws://localhost:8080/me/revisions` |
| Prod (Cloud Run) | `https://<cloud-run-url>/v1` | `wss://<cloud-run-url>/me/revisions` |

- **The backend IS deployed to Cloud Run** via `.github/workflows/deploy.yml`,
  which runs automatically on every push to `main` (`gcloud run deploy` with
  `--allow-unauthenticated --port 8080`). There is **one environment** (prod on
  `main`); there is no separate staging pipeline.
- **Fixed deploy coordinates** (from `terraform/main.tf` + repo vars):
  - GCP project: **`aqademiqbackendv1`**
  - Region: **`europe-west1`**
  - Cloud Run service: **`aqademiq-backend`**
- **The literal `*.run.app` URL is not stored in the repo** (it depends on the
  GCP project number). Get it from whoever owns the project, or run:
  `gcloud run services describe aqademiq-backend --region europe-west1 --format='value(status.url)'`.
  The Cloud Run URL form is `https://aqademiq-backend-<PROJECT_NUMBER>.europe-west1.run.app`.
- **Health check:** the deploy verifies `GET /v1/healthz` returns `{ "status": "ok" }`
  after each rollout — use the same path for your own connectivity check.
- **⚠️ Prod is deployed but only partially configured.** The deploy step injects
  **only** `DATABASE_URL` + JWT keys (secrets) and `REDIS_HOST/REDIS_PORT` (env).
  It does **not** set `GCS_*`, Claude/Vertex, `EMAIL_PROVIDER_API_KEY`, FCM/APNs,
  or `REDIS_AUTH_STRING`. So on the live service, core auth + tasks + realtime work,
  but **files/uploads, Ada/AI, email, and push are unconfigured** and will behave
  like the ⛔/🟡 endpoints flagged in this doc until those secrets are wired.
- **`/v1` prefix is global** and applied in `main.ts` (`app.setGlobalPrefix('v1')`).
  Every REST path in this doc already includes it.
- **Port:** `PORT` env, defaults to **8080** (Cloud Run deploys with `--port 8080`).
- **CORS:** `app.enableCors({ origin: true })` — reflects any request origin
  (all origins allowed). Credentials mode is **not** enabled; the client sends
  the token in the `Authorization` header, not cookies.
- **Swagger UI:** `GET /docs`; raw spec at `GET /docs-json` (both public).
- The OpenAPI `servers` array is empty; prepend the base URL per env yourself.

---

## 2. Wire conventions

- **snake_case everywhere**, in both directions. DTO properties are literally
  declared snake_case; **there is no serializer case transform**. Send and expect
  snake_case exactly as written here.
- **`ValidationPipe`** runs globally with `whitelist: true`,
  `forbidNonWhitelisted: true`, `transform: true`. Consequences for the client:
  - **Unknown/extra body fields cause a 400** (`forbidNonWhitelisted`). Send only
    the documented fields.
  - `transform: true` coerces types (e.g. numeric strings → numbers) but does
    **not** rename keys.
- **Dates & times:**
  - **Date-only fields** use `yyyy-MM-dd` (strict regex `^\d{4}-\d{2}-\d{2}$`),
    interpreted at **UTC midnight**. Examples: `date`, `until_date`, `from`,
    `to`, `start`, `end`, `date_of_birth`, `task_date`. Send a plain calendar
    date string; do not send a datetime.
  - **Datetime fields** (server-generated: `created_at`, `login_at`,
    `last_message_at`, `grace_until`, `exported_at`) are **ISO 8601 UTC** with a
    `Z` suffix (e.g. `2026-07-04T09:12:33.000Z`).
  - **`scheduled_at`** is special: a **naive local wall-clock ISO string**
    (stored as a plain string, echoed back verbatim, never parsed to UTC). Use it
    for the time-of-day you want to display. Omit it for an "anytime" task.
  - **Clock times** (`notification_time*`, channel `send_time`) are local
    wall-clock `HH:MM` 24h (regex `^([01]\d|2[0-3]):[0-5]\d$`).
- **Numbers** are plain JSON numbers. Durations are **seconds** (`duration_seconds`,
  `elapsed_sec`) except focus `planned_min` and `daily_focus_goal_min` which are
  **minutes**.
- **Enums** are exact case-sensitive strings — see §11.
- **IDs** are UUID v4 strings, **except task occurrence ids** which are
  `{series_id}@{yyyy-MM-dd}` (see §12/mismatch 5).

---

## 3. Auth lifecycle (READ FIRST — replaces Identity Platform)

> **⚠️ MISMATCH 1 — authoritative answer:** The client must **drop
> `firebase_auth` / Identity Platform entirely** (`signInAnonymously`,
> `linkWithCredential`, Firebase ID tokens). Authentication is this backend's
> **own RS256 JWT system**. Firebase is used **only** for FCM push tokens
> (device registration), never for auth. Store the returned `access_token` +
> `refresh_token` in secure storage (Keychain / Keystore, e.g.
> `flutter_secure_storage`) and attach the access token as
> `Authorization: Bearer <access_token>` on every request.

### 3.1 Token contract

Every "login-like" endpoint (`guest`, `verify-otp`, `signin`, `sso/*`) returns
the **same token-pair-plus-user** shape:

```json
{
  "access_token": "eyJhbGciOiJSUzI1Ni... (RS256 JWT)",
  "refresh_token": "5f3c...uuid.sid.base64url-secret",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": { "id": "uuid", "email": "a@b.com", "is_guest": false }
}
```

- **`access_token`**: RS256 JWT, TTL **900s** (`ACCESS_TTL_SECONDS`). Claims:
  `sub` (user id), `sid` (session id), `is_guest` (bool), plus `iss=aqademiq`,
  `aud=aqademiq-app`, `exp`, `iat`. `sid` and `is_guest` live **inside the JWT**,
  not as separate top-level response fields — read `user.is_guest` for guest
  state; decode the JWT if you need `sid`.
- **`refresh_token`**: opaque `"{session_id}.{secret}"`, TTL **60 days**
  (`REFRESH_TTL_DAYS`). Store securely; it is single-use (rotated on every
  refresh).
- **`token_type`** is always `"Bearer"`.
- **`expires_in`** is the access-token lifetime in seconds.

> **⚠️ NOTE:** `POST /v1/auth/refresh` returns the token pair **without** the
> `user` object (just `access_token`/`refresh_token`/`token_type`/`expires_in`).
> All other login endpoints include `user`.

### 3.2 Header format & the 401-refresh interceptor

- Header: `Authorization: Bearer <access_token>`.
- On **401**, the standard error body is returned via the exception filter:

```json
{
  "status_code": 401,
  "error": "UNAUTHORIZED",
  "message": "Invalid token",
  "path": "/v1/tasks",
  "timestamp": "2026-07-04T09:12:33.000Z"
}
```

  `message` is one of `"Missing bearer token"`, `"Invalid token"`, or
  `"Session revoked"`.
- **Dio refresh-on-401 recipe:** on a 401 (that is not itself an `/auth/*`
  call), call `POST /v1/auth/refresh` with the stored `refresh_token`, replace
  both tokens, and retry the original request once. If refresh **also** 401s
  (see reuse below), wipe tokens and route to sign-in.
- **Refresh rotation & reuse detection:** each refresh **revokes** the old
  session and issues a new pair. Presenting an already-rotated/revoked refresh
  token triggers theft protection: **all** the user's sessions are revoked and
  you get `401 "Refresh token reuse detected — all sessions revoked"`. Never
  refresh concurrently with the same token (serialize refreshes).

### 3.3 Flows (endpoints detailed in §12 Auth)

- **Guest:** `POST /auth/guest` → token pair (`user.is_guest=true`). No input.
- **Email signup:** `POST /auth/signup {email,password}` → **no tokens**, returns
  `pending_verification` + issues a **6-digit OTP** (TTL **600s / 10 min**).
  **Signup itself sends the code** (no separate send call). In non-prod the code
  is returned as `dev_code` and always logged to the server console.
  Then `POST /auth/verify-otp {email,code}` → token pair. Resend via
  `POST /auth/resend-otp {email}` (24s cooldown → 429).
- **Signin:** `POST /auth/signin {email,password}` → token pair. **5 failed
  attempts → 15-min lockout (429)**.
- **SSO:** `POST /auth/sso/google {id_token}` / `POST /auth/sso/apple
  {identity_token, full_name?}`. The client posts the **provider's OAuth *ID
  token* (JWT)** from the native Google/Apple SDK — **not** a Firebase token. The
  server verifies it against Google/Apple JWKS; accepted audiences =
  `GOOGLE_OAUTH_CLIENT_IDS` / `APPLE_OAUTH_CLIENT_IDS` (your OAuth client ids).
  Returns a token pair. **422** if the provider isn't configured server-side.
- **Refresh:** `POST /auth/refresh {refresh_token}` → new pair (no `user`).
- **Sign-out:** `POST /auth/signout` (bearer) → marks current session
  `logged_out`. Client discards tokens.
- **Sessions:** `GET /auth/sessions`; revoke one `DELETE /auth/sessions/:id`;
  revoke all `POST /auth/sessions/revoke-all`.
- **Password change:** `POST /auth/change-password {old_password,new_password}`
  (bearer) → revokes all *other* sessions.
- **Email change (2-step):** `POST /auth/change-email/request {new_email}` →
  OTP to the new address; `POST /auth/change-email/verify {new_email,code}`.
- **Account delete:** `DELETE /auth/account` → soft-delete + 30-day grace.
- **Password reset (3-step):** `forgot-password` → `forgot-password/verify` →
  `forgot-password/reset`.

### 3.4 Link guest → real account ("Save progress")

> **⚠️ MISMATCH 1 (cont.):** replaces Firebase `linkWithCredential`.

1. While signed in as guest (bearer), `POST /auth/link-guest {email,password}`.
   This attaches an email identity to the **same user id** and issues a 6-digit
   OTP (`pending_verification`, TTL 600s). **All existing guest data is kept**
   (same `user.id`).
2. `POST /auth/verify-otp {email,code}` → flips the user to non-guest and mints a
   **new** token pair. The old guest tokens/session are **not** auto-revoked, but
   you should replace them with the new pair immediately.
   Result: same user id, `is_guest` now `false`, all tasks/subjects/etc intact.

---

## 4. Idempotency

- Header: **`Idempotency-Key: <string>`** (recommend a **UUID v4** per logical
  action). Applies to **any mutating method** (`POST`/`PATCH`/`PUT`/`DELETE`).
- Behavior: first call runs and its **2xx** response is cached for **24h**,
  scoped by `sha256(authorizationHeader + key)` (so keys never cross users). A
  repeat with the same key **replays the stored response** and adds header
  `Idempotent-Replay: true`. Non-2xx responses are **not** cached (safe to retry).
- **Strongly recommended on:** `POST /onboarding/complete`, `POST /tasks`,
  `POST /ada/.../apply-plan`, `POST /ada/plan-week`, `POST /focus-sessions`,
  `POST /mood-entries`, `POST /devices`, `POST /subjects`, `POST /semesters`,
  and any create where a retry could duplicate. It is harmless (and encouraged)
  on all mutations.

---

## 5. Rate limiting

- **Per client IP, fixed 60s window** (`RateLimitMiddleware`):
  - `/v1/auth/*` → **20 requests / min**
  - everything else → **200 requests / min**
- On limit, **429** with header **`Retry-After: <seconds>`**.

> **⚠️ SPEC DRIFT (two different 429 shapes):**
> - The **middleware** 429 bypasses the exception filter and returns a
>   **camelCase** body: `{ "statusCode": 429, "message": "Too many requests" }`.
> - The **auth-service** 429s (signin lockout, OTP cooldown, OTP attempts) go
>   through the filter → standard snake_case body (`status_code`, `error:
>   "TOO_MANY_REQUESTS"`, `message`, ...).
>
> The client's 429 handler must tolerate **both** `statusCode` and `status_code`.
> Always honor `Retry-After` when present.

---

## 6. Error model

All errors except the middleware 429 (above) use this uniform shape
(`HttpExceptionFilter`):

```json
{
  "status_code": 422,
  "error": "UNPROCESSABLE_ENTITY",
  "message": "Unknown subject_id",
  "errors": ["task[0]: missing title"],
  "path": "/v1/tasks",
  "timestamp": "2026-07-04T09:12:33.000Z"
}
```

- **`status_code`**: numeric HTTP status.
- **`error`**: `HttpStatus` name string — the set the client should branch on:
  `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND`
  (404), `CONFLICT` (409), `UNPROCESSABLE_ENTITY` (422), `TOO_MANY_REQUESTS`
  (429), `INTERNAL_SERVER_ERROR` (500), `NOT_IMPLEMENTED` (501).
- **`message`**: string **or array of strings**. For **class-validator body
  validation failures (400)**, `message` is an **array** of constraint messages
  (e.g. `["email must be an email", "password must be longer than or equal to 8
  characters"]`). For most other errors it is a single string.
- **`errors`**: optional string array, present only for custom multi-error
  responses (notably Ada `apply-plan`/`plan-week` validation).
- Branching guidance: validation → 400 (array `message`); auth expiry/revocation
  → 401; not-verified/not-configured-provider/not-active → 403 or 422; duplicate
  email / last-semester delete → 409; unknown id → 404 or 422; stubs → 501.

---

## 7. Pagination

**There is no pagination.** No list/history endpoint accepts `limit`/`offset`/
`cursor` params or returns a page envelope. Lists return the **full array**
(bounded server-side where relevant):

- `GET /me/notifications/history` and `/inbox` return at most **100** rows
  (newest first), no continuation token.
- `GET /tasks/history/completions` returns a `{ "yyyy-MM-dd": count }` map.
- `GET /tasks?from&to` is capped at a **366-day** range (400 if exceeded).
- All other lists (`subjects`, `semesters`, `study-tags`, `ada/conversations`,
  `messages`, `sessions`) return everything owned by the user.

If you need "infinite scroll," page client-side. (The `since`-cursor on
`/sync/changes` is a *delta* cursor, not list pagination — see §8.)

---

## 8. Realtime + sync

> **⚠️ MISMATCH 2 — authoritative answer:** There is **no `focus:tick` event**
> and no per-second server push of anything. The only realtime channel is a
> **revision-invalidation** stream. Live updates follow **signal → refetch**:
> the server emits a lightweight `revision` bump; the client then pulls the delta
> via `/sync/changes`.

### 8.1 WebSocket — `/me/revisions` (Socket.IO)

- **Transport:** Socket.IO, **namespace `/me/revisions`** (default Socket.IO
  path `/socket.io`). Full URL e.g. `ws://localhost:8080/me/revisions`.
- **Handshake auth (any one of):**
  - `auth: { token: "<access_token>" }` (preferred), or
  - query `?token=<access_token>`, or
  - header `Authorization: Bearer <access_token>`.
  Missing/invalid token → server **disconnects** the socket immediately.
- **Server → client events:**
  - `connected` — on successful auth: `{ "user_id": "uuid" }`.
  - `revision` — on any mutation to the user's data:
    ```json
    { "revision": 42, "entity": "tasks", "at": "2026-07-04T09:12:33.000Z" }
    ```
    `revision` is a monotonically increasing per-user integer (same counter as
    the sync cursor namespace). `entity` is a hint string (`tasks`, `mood`,
    `settings`, `onboarding`, `email_preferences`, `notification_preferences`,
    `notification_channels`, or `null`) — treat it as advisory; always refetch
    via `/sync/changes` rather than trusting the hint.
- **Rooms:** each socket joins `user:{id}`; bumps fan out via Redis pub/sub so it
  works across server instances. There is **no** client→server event to emit.

### 8.2 Delta sync — `/sync/*`

- **`GET /v1/sync/cursor`** (bearer, ✅) → `{ "cursor": 1720082400000 }`. The
  cursor is the **DB clock in epoch milliseconds** (number). Fetch once at
  startup to establish a baseline.
- **`GET /v1/sync/changes?since=<ms>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>`**
  (bearer, ✅). All three query params **optional** (⚠️ spec says required):
  - `since` — last cursor you hold (epoch ms as a string). Omit/empty → full
    snapshot from `0`.
  - `from`/`to` — optional task-materialization window; defaults to **today →
    today+13 days** when a task delta is emitted.
  - Response:
    ```json
    {
      "cursor": 1720082500000,
      "changes": {
        "subjects":  { "upserts": [ /* full Subject DTOs, see §12 */ ], "tombstones": ["subject_id", ...] },
        "semesters": { "upserts": [ /* Semester DTOs */ ], "tombstones": ["semester_id", ...] },
        "tags":      { "upserts": [ /* {id,label,color} */ ] },
        "mood":      { "upserts": [ /* {date,mood_index,intention,reflection} */ ] },
        "tasks":     { "window": { "from": "2026-07-04", "to": "2026-07-17" }, "items": [ /* occurrence DTOs */ ] }
      }
    }
    ```
    - `tasks` is **`null`** when no series/override changed since `since` (avoids
      re-sending the window every poll). When present, `items` is the full
      re-materialized window (treat as authoritative for that date range).
    - `tags`/`mood` have **no tombstones** (hard-deleted / upsert-only).
    - Persist the returned `cursor` for the next call.
- **`POST /v1/sync/mutations`** — ⛔ **NOT IMPLEMENTED** (501). Batch push is
  deferred; **use the per-feature endpoints with an `Idempotency-Key`** for
  offline replay.

### 8.3 The intended live-update pattern

1. On login, open the `/me/revisions` socket and call `GET /sync/cursor` (or a
   full `GET /sync/changes` with no `since`) to seed local state.
2. On each `revision` event, call `GET /sync/changes?since=<lastCursor>` (and
   `from`/`to` matching the calendar range currently on screen), apply
   upserts/tombstones, store the new `cursor`.
3. If the socket drops, reconnect and do one `GET /sync/changes` to catch up.

### 8.4 How the focus timer stays live (no server tick)

The focus timer is **client-local ticking**, checkpoint-synced:

- `POST /focus-sessions` starts a server row (status `RUNNING`) and returns it.
- The **client counts seconds locally** and renders the countdown itself.
- Periodically (and on pause/resume/background) call
  `PATCH /focus-sessions/:id { elapsed_sec, status }` to persist progress
  (`status` ∈ `RUNNING|PAUSED`). There is **no** per-second network call.
- `POST /focus-sessions/:id/complete { elapsed_sec?, mood_index? }` finalizes
  (status `COMPLETE`) and, if the session was linked to a task occurrence,
  **atomically marks that task done** (feeding streaks) and returns the updated
  task under `linked_task`.
- A completed focus session bumps activity/streak state, which will produce a
  `revision` event other screens can react to. **Do not** expect `focus:tick`.

---

## 9. Files / uploads (GCS presigned)

General 3-step pattern: **init (get signed URL) → client `PUT` bytes to GCS →
commit**. All file endpoints return **501 NOT_IMPLEMENTED** when
`GCS_USER_BUCKET` is unset (`message: "File storage is not configured (set
GCS_USER_BUCKET)"`) — mock locally until buckets exist.

**The `PUT` to the signed URL:**
- Method **`PUT`**, body = **raw file bytes**.
- Header **`Content-Type` must equal** the `mime_type` you sent to `init` (the
  URL is signed with that content type; default `application/octet-stream` if you
  omitted it). A mismatch is rejected by GCS.
- Do **not** send the `Authorization` header to GCS (it's a signed URL).
- URL TTL: **5 minutes** (both upload and download).
- **Size/type limits:** none enforced server-side today (`size_bytes` is optional
  metadata only). ⚠️ Enforce sane limits client-side.

### 9.1 Subject files (Subject detail screen)
1. `POST /v1/uploads/init { subject_id, name, kind?, mime_type?, size_bytes? }`
   → `{ file_id, upload_url, key }` (creates the DB row, `scan_status=pending`).
2. `PUT <upload_url>` with the bytes.
3. `POST /v1/uploads/{file_id}/commit` → the file DTO (`scan_status=clean`,
   `files_count` incremented).

### 9.2 Onboarding syllabus (before a subject exists)
1. `POST /v1/uploads/staging/init { name, kind?, mime_type?, size_bytes? }` →
   `{ upload_id, upload_url, key, name, mime_type }` (**no DB row yet**).
2. `PUT <upload_url>` with the bytes.
3. Pass `key`/`name`/`mime_type` into the onboarding subject entry as
   `syllabus_staging_key` / `syllabus_file_name` / `syllabus_mime_type` (see
   §12 Onboarding). `POST /onboarding/complete` creates the real `SubjectFile`.

### 9.3 Ada attachments (chat)
1. `POST /v1/ada/uploads { conversation_id, name, mime_type?, size_bytes? }` →
   `{ file_id, upload_url, key, name }`.
2. `PUT <upload_url>` with the bytes.
3. Reference `{ key, name, mime_type? }` in the `attachments` array of the next
   `POST /ada/conversations/:id/messages`. **No commit step.**

### 9.4 Download / thumbnail / delete / patch
- `GET /v1/files/:id/download` → `{ url, expires_in: 300 }` (owner-only signed
  read URL). Foreign/deleted ids → 404.
- `GET /v1/files/:id/thumbnail` → ⛔ **NOT IMPLEMENTED** (501).
- `PATCH /v1/files/:id { important?, name? }` → updated file DTO.
- `DELETE /v1/files/:id` → `{ status: "deleted", id }` (soft delete, decrements
  `files_count`).

### 9.5 Profile photo
**Not supported.** There is **no** avatar photo upload — the profile uses a
preset `avatar_index` (0–7). See §12 Profile.

---

## 10. Ada / AI

- **Transport is plain JSON request/response — NOT streaming (no SSE, no
  socket).** `POST .../messages` blocks until the full assistant turn is ready,
  then returns **both** the persisted user message and the assistant reply.
  Model calls (Opus, multi-turn tool loop) can take several seconds — show a
  "thinking" spinner while the POST is in flight; there are no intermediate
  chunks.
- **"Context"** is managed server-side: Ada loads the last **20** messages of the
  conversation and grounds itself using read-only tools (`list_subjects`,
  `list_day_tasks`). The client only sends `text` (+ optional `attachments`);
  there is no client-supplied context parameter.
- **AI provider:** `AI_PROVIDER=gemini_vertex` (Vertex AI, prod default) or
  `gemini_studio` (Google AI Studio API key). Legacy Claude providers
  (`anthropic`, `vertex`) remain supported. Model: `gemini-2.5-flash` via
  `GEMINI_MODEL` / `GEMINI_MODEL_FAST`.
- **AI not configured** (`AI_PROVIDER=none` or missing credentials): messages are
  still saved; the assistant reply is a fixed placeholder with `plan: null`.
  `plan-week` returns **501** in that case.
- **Two-step apply-plan safety gate (§4.3):** Ada only *proposes*. An assistant
  message may carry a `plan` (array of days) + `plan_footer`. The user reviews
  the plan card and confirms; the client then calls
  `POST /ada/conversations/:cid/messages/:mid/apply-plan`, which **validates
  every field** (owned `subject_id`, sane duration, parseable dates/repeat) and
  creates the tasks **atomically** — invalid plans are rejected wholesale (422
  with `errors[]`). No raw model output ever mutates data without this gate.
- **Processing states to render:** `idle` → `sending` (POST in flight) →
  `reply shown` (if `plan != null`, show the plan card with an "Add to plan"
  button) → on confirm `applying` (apply-plan in flight) → `applied` (show
  `applied` count / refetch the day). `plan-week` has the same
  `generating → applied` shape.

See §12 Ada for exact bodies/shapes.

---

## 11. Enum dictionaries (exact wire strings)

| Concept | Field | Exact values | Notes |
|---|---|---|---|
| **Repeat frequency** | `repeat.kind` | `none`, `daily`, `weekdays`, `weekly`, `monthly`, `everyNDays`, `everyNWeeks`, `everyNMonths` | See mismatch 3. `interval` (int 1–365) applies to the `everyN*` kinds. |
| Repeat interval | `repeat.interval` | integer 1–365 (default 1) | Only meaningful for `everyNDays/everyNWeeks/everyNMonths`. |
| **Task status** | `status` | `PENDING`, `COMPLETE` | Uppercase. |
| **Focus status** | `status` | `RUNNING`, `PAUSED` (checkpoint input); `COMPLETE` (set by complete) | Start always creates `RUNNING`. |
| **Mood index** | `mood_index` | integer `0,1,2,3,4` | 5-point scale. There is **no named "phase" enum** — it's an index; the client owns the label/emoji mapping. Same 0–4 index is reused for subject `mood` and focus `mood_index`. |
| Theme | `theme_mode` | `light`, `dark`, `system` | Server-owned (settings). |
| Notification sound | `notification_sound` | `Chime`, `Pulse`, `Glass`, `Drop`, `None` | Title-case. |
| Device platform | `platform` | `ios`, `android` | |
| Push provider | `token_provider` | `apns`, `fcm` | APNs send path is stubbed server-side; FCM works. |
| Push permission | `permission` | `granted`, `denied`, `provisional` | |
| Auth provider | `user.auth_provider`* | `guest`, `email`, `google`, `apple` | *Not returned in the public user object; informational. |
| File kind | `kind` | `syllabus`, `slides`, `notes`, `paper` | Anything else is normalized to `notes`. |
| Prism mode | `prism-modes[].key` | `none`, `rain`, `forest`, `cafe`, `whitenoise` | `none` = "No sound". |
| Ada role | `messages[].is_user` | boolean (`true`=user, `false`=Ada) | **Not** a string enum. |
| Subject target grade | `target_grade` | **free-form string** (default `""`) | ⚠️ No enum/"target kind" exists server-side — send any string the UI collects. |
| Notification channel key | `channel_key` | free-form string (e.g. `morning`, `review`, `test`) | Not constrained by an enum; the reminder cron currently emits `morning`/`review`. |

> **Time-of-day / "day-part":** there is **no day-part enum**. A task's time is
> the free `scheduled_at` wall-clock string (or absent = "anytime"). Derive any
> morning/afternoon/evening bucketing on the client.

---

## 12. Endpoint contracts by domain

> Reminder: response success shapes below come from the service code (not the
> spec). Standard errors (§6) are omitted per-endpoint except where notable.

---

### 12.A Auth & session (`AuthController`, base `/v1/auth`) — all ✅

For the shared token-pair-plus-user response, see §3.1 (`TokenPair`).

#### `POST /v1/auth/guest` — public
- **Purpose:** Anonymous "continue as guest" on the welcome screen.
- **Input:** no body. (`Idempotency-Key` optional.)
- **Output 201:** `TokenPair` with `user.is_guest=true`, `user.email=null`.
```json
{ "access_token":"...", "refresh_token":"...", "token_type":"Bearer", "expires_in":900,
  "user": { "id":"uuid", "email":null, "is_guest":true } }
```

#### `POST /v1/auth/signup` — public
- **Purpose:** Start email registration (email + password screen).
- **Input body:**

| field | type | req | rules |
|---|---|---|---|
| `email` | string | ✓ | valid email |
| `password` | string | ✓ | min length 8 |

```json
{ "email": "a@b.com", "password": "hunter2xy" }
```
- **Output 201** (no tokens yet):
```json
{ "status":"pending_verification", "user_id":"uuid", "expires_in":600, "dev_code":"019345" }
```
  `dev_code` present **only in non-prod** (also logged to server console).
- **Errors:** `409 CONFLICT "An account with this email already exists"` (email
  already verified); `400` validation.

#### `POST /v1/auth/verify-otp` — public
- **Purpose:** Confirm the signup OTP → become authenticated.
- **Input body:** `email` (email), `code` (string, regex `^\d{6}$`).
```json
{ "email":"a@b.com", "code":"019345" }
```
- **Output 201:** `TokenPair` + `user` (`is_guest=false`).
- **Errors:** `400 "Invalid or expired code"`; `429 "Too many attempts — request a new code"`.

#### `POST /v1/auth/resend-otp` — public
- **Purpose:** Resend the signup code.
- **Input body:** `{ "email":"a@b.com" }`.
- **Output 201:** `{ "status":"sent", "expires_in":600, "dev_code":"..."? }`. Always
  `sent` even if the email is unknown (no enumeration).
- **Errors:** `429 "Please wait Ns before requesting another code"` (24s cooldown).

#### `POST /v1/auth/signin` — public
- **Purpose:** Email + password login.
- **Input body:** `email` (email), `password` (string 1–256).
- **Output 201:** `TokenPair` + `user`.
- **Errors:** `401 "Invalid email or password"`; `403 "Email not verified"`;
  `403 "Account is not active"`; `429 "Too many failed attempts — try again later"`
  (after 5 fails, 15-min lockout).

#### `POST /v1/auth/refresh` — public
- **Purpose:** Rotate tokens (used by the 401 interceptor).
- **Input body:** `{ "refresh_token": "<stored refresh token>" }` (string, min 10).
- **Output 201:** token pair **without** `user`:
```json
{ "access_token":"...", "refresh_token":"...", "token_type":"Bearer", "expires_in":900 }
```
- **Errors:** `401 "Invalid refresh token"`; `401 "Refresh token reuse detected — all sessions revoked"`.

#### `POST /v1/auth/forgot-password` — public
- **Input:** `{ "email":"a@b.com" }`. **Output 201:** `{ "status":"sent", "dev_code":"..."? }` (always `sent`).

#### `POST /v1/auth/forgot-password/verify` — public
- **Input:** `{ "email", "code":"^\d{6}$" }`. **Output 201:** `{ "valid": true }` (or `400`).

#### `POST /v1/auth/forgot-password/reset` — public
- **Input:** `{ "email", "code":"^\d{6}$", "new_password": "min8" }`.
- **Output 201:** `{ "status":"reset" }`. Revokes all sessions for the user.

#### `POST /v1/auth/change-password` — bearer
- **Input:** `{ "old_password":"1–256", "new_password":"min8" }`.
- **Output 201:** `{ "status":"changed" }`. Revokes all sessions except the current.
- **Errors:** `400 "Current password is incorrect"`.

#### `POST /v1/auth/link-guest` — bearer (guest only)
- **Purpose:** "Save progress" — attach email/password to the guest account.
- **Input:** `{ "email", "password":"min8" }`.
- **Output 201:** `{ "status":"pending_verification", "user_id":"<same id>", "expires_in":600, "dev_code":"..."? }`.
  Follow with `verify-otp`. **Data preserved under the same user id.**
- **Errors:** `409 "Account is already registered"`; `409 "An account with this email already exists"`.

#### `POST /v1/auth/signout` — bearer
- **Input:** none. **Output 201:** `{ "status":"signed_out" }`.

#### `GET /v1/auth/sessions` — bearer
- **Output 200:**
```json
{ "sessions": [ { "id":"uuid", "ip_address":"1.2.3.4", "user_agent":"...", "login_at":"2026-07-04T09:12:33.000Z", "current":true } ] }
```

#### `DELETE /v1/auth/sessions/:id` — bearer
- **Output 200:** `{ "status":"revoked" }`. **Errors:** `404 "Session not found"`.

#### `POST /v1/auth/sessions/revoke-all` — bearer
- **Output 201:** `{ "status":"revoked_all" }`.

#### `POST /v1/auth/sso/google` — public
- **Purpose:** Google Sign-In. **Input:** `{ "id_token":"<Google OAuth ID token JWT>" }`.
  ⚠️ body not in spec.
- **Output 201:** `TokenPair` + `user`.
- **Errors:** `422 "Google sign-in is not configured..."`; `401 "Invalid or expired Google identity token"`.

#### `POST /v1/auth/sso/apple` — public
- **Input:** `{ "identity_token":"<Apple identity token JWT>", "full_name":"Ada L."? }`
  (`full_name` optional, only sent by Apple on first sign-in). ⚠️ body not in spec.
- **Output 201:** `TokenPair` + `user`.
- **Errors:** `422 "Apple sign-in is not configured..."`; `401 "Invalid or expired Apple identity token"`.

#### `DELETE /v1/auth/account` — bearer
- **Output 200:** `{ "status":"scheduled_for_deletion", "grace_until":"2026-08-03T09:12:33.000Z" }`.
  Soft-delete + 30-day grace; revokes all sessions.

#### `POST /v1/auth/change-email/request` — bearer
- **Input:** `{ "new_email":"new@b.com" }`. ⚠️ body not in spec.
- **Output 201:** `{ "status":"sent", "expires_in":600, "dev_code":"..."? }` (OTP to the **new** address).
- **Errors:** `409 "An account with this email already exists"`.

#### `POST /v1/auth/change-email/verify` — bearer
- **Input:** `{ "new_email":"new@b.com", "code":"^\d{6}$" }`. ⚠️ body not in spec.
- **Output 201:** `{ "status":"changed", "email":"new@b.com" }`.

---

### 12.B Onboarding (`OnboardingController`) — ✅

#### `POST /v1/onboarding/complete` — bearer (guest-ok)
- **Purpose:** Submit the whole onboarding wizard (name, semester, subjects +
  optional staged syllabi, focus goal, peak times, education level, referral).
  Atomic + **idempotent** (re-run returns current state without duplicating).
  Send an `Idempotency-Key`.
- **Input body** (all fields optional):

| field | type | rules |
|---|---|---|
| `referral_code` | string | free-form (attribution deferred, see §12.N) |
| `name` | string | 0–120 → written to profile |
| `education_level` | string | free-form → settings |
| `semester` | object | `{ name:1–120, start:"yyyy-MM-dd", end:"yyyy-MM-dd" }`; defaults to "My Semester", today→+6mo if omitted |
| `subjects` | array | each: see below |
| `daily_focus_goal_min` | int | 0–1440 → settings |
| `work_best_times` | any (JSON) | opaque; stored on settings |

  **`subjects[]` entry:**

| field | type | rules |
|---|---|---|
| `name` | string | ✓ 1–120 |
| `color_hex` | string | `#RRGGBB`; defaults from palette by index |
| `mood` | int | 0–4 |
| `syllabus_staging_key` | string | from `uploads/staging/init` (§9.2) |
| `syllabus_file_name` | string | 0–255 |
| `syllabus_mime_type` | string | |

```json
{
  "name": "Ada",
  "education_level": "undergraduate",
  "semester": { "name":"Fall 2026", "start":"2026-09-01", "end":"2026-12-20" },
  "subjects": [
    { "name":"Calculus", "color_hex":"#4F8DFD", "mood":3,
      "syllabus_staging_key":"quarantine/users/.../staging/.../syllabus.pdf",
      "syllabus_file_name":"syllabus.pdf", "syllabus_mime_type":"application/pdf" }
  ],
  "daily_focus_goal_min": 120,
  "work_best_times": { "mon": ["09:00","14:00"] }
}
```
- **Output 201:**
```json
{ "profile_name":"Ada", "semesters":1, "subjects":1, "daily_focus_goal_min":120, "status":"completed" }
```
  `status` is `"completed"` on first run, `"already_completed"` on idempotent re-run.

---

### 12.C Tasks / Plan (`TasksController`, base `/v1/tasks`) — ✅

**Occurrence model (see mismatch 5):** a task is a `TaskSeries` (with a repeat
rule); individual days are **occurrences** identified by `"{series_id}@{yyyy-MM-dd}"`.
`toggle`/`patch`/`delete`/`move` act on **one occurrence**; `create` makes a
series. There is **no whole-series edit endpoint** — per-occurrence overrides only.

**Occurrence DTO** (returned by create/patch/toggle and inside `query`/`sync`):
```json
{
  "id": "SERIES_UUID@2026-07-04",
  "title": "Read chapter 3",
  "subject_id": "uuid",
  "duration_seconds": 1800,
  "scheduled_at": "2026-07-04T14:00:00",
  "status": "PENDING",
  "category": "reading",
  "repeat": { "kind": "weekly", "interval": 1 },
  "steps": [ { "id":"...", "title":"Plan: Read chapter 3", "duration_seconds":600, "status":"PENDING" } ]
}
```

#### `GET /v1/tasks?date=&from=&to=` — bearer
- **Purpose:** Load a day (Plan screen) or a range. All params optional.
  - `date=yyyy-MM-dd` → that single **UTC day** (defaults to today if all omitted).
  - `from` + `to` (both `yyyy-MM-dd`) → inclusive range (max **366** days).
- **Timezone semantics:** recurrence is computed at **UTC-day precision**. Send
  the calendar date the user is viewing as `yyyy-MM-dd`; the wall-clock time for
  display comes from each occurrence's `scheduled_at`.
- **Output 200:** `{ "tasks": [ <occurrence DTO>, ... ] }`.
- **Errors:** `400 "`from` must be <= `to`"`, `400 "range exceeds 366-day horizon cap"`.

#### `POST /v1/tasks` — bearer
- **Purpose:** Create a task/series (quick-add or full form).
- **Input body:**

| field | type | req | rules / default |
|---|---|---|---|
| `title` | string | ✓ | |
| `subject_id` | string | | defaults to the user's first subject if omitted |
| `duration_seconds` | int | | ≥0, default 300 |
| `scheduled_at` | string | | naive wall-clock ISO; omit = "anytime" |
| `category` | string | | |
| `date` | string | | `yyyy-MM-dd` anchor/first date; defaults today (UTC) |
| `repeat` | object | | `{ kind: <enum §11>, interval?: 1–365 }`; default `{none,1}` |
| `until_date` | string | | `yyyy-MM-dd` end bound for recurrence |

```json
{ "title":"Read chapter 3", "subject_id":"uuid", "duration_seconds":1800,
  "scheduled_at":"2026-07-04T14:00:00", "date":"2026-07-04",
  "repeat":{ "kind":"weekly", "interval":1 } }
```
- **Output 201:** the anchor **occurrence DTO** (`steps: []`).
- **Errors:** `422 "Unknown subject_id"`; `422 "No subject available — create a subject first"`.

#### `PATCH /v1/tasks/:occ` — bearer
- **Purpose:** Edit one occurrence (reschedule / set status).
- **Path:** `:occ` = occurrence id. **Input body:** `{ scheduled_at?:string, status?:"PENDING"|"COMPLETE" }`.
- **Output 200:** updated occurrence DTO. **Errors:** `404 "Task not found"`/`"No such occurrence"`/`"Occurrence deleted"`.

#### `PATCH /v1/tasks/:occ/toggle?date=` — bearer
- **Purpose:** Flip done/undone for one occurrence (checkbox on Plan). Only this
  occurrence is affected; siblings in the series are untouched. `date` query is
  optional/ignored (the date is in `:occ`).
- **Output 200:** updated occurrence DTO (`status` toggled). Toggling to COMPLETE
  also writes an activity event (feeds streaks).

#### `POST /v1/tasks/move` — bearer
- **Purpose:** Drag an occurrence (or all of a day's tasks) to another day.
- **Input body:** `{ from:"yyyy-MM-dd", to:"yyyy-MM-dd", ids?:["SERIES@DATE", ...] }`.
  Omit/empty `ids` → move **every** task materialized on `from`.
- **Output 200:** `{ "moved": 3, "from":"2026-07-04", "to":"2026-07-05" }`.

#### `DELETE /v1/tasks/:occ` — bearer
- **Purpose:** Delete one occurrence (tombstone; never regenerates).
- **Output 200:** `{ "status":"deleted", "id":"SERIES@DATE" }`.

#### `POST /v1/tasks/:occ/breakdown` — bearer
- **Purpose:** "Break into steps" — AI (Haiku) microsteps, with a deterministic
  template fallback when AI is unconfigured or errors (so it **always** returns).
- **Input body:** `{ date?:"yyyy-MM-dd" }` (optional; date is in `:occ`).
- **Output 201:**
```json
{ "steps": [ { "id":"SERIES@DATE-bd<ts>-0", "title":"Plan: Read chapter 3", "duration_seconds":600, "status":"PENDING" } ] }
```

#### `GET /v1/tasks/history/completions` — bearer
- **Purpose:** Heatmap of completed-task counts by day (Stats/streak calendar).
- **Output 200:** a **map**, not an array: `{ "2026-07-01": 2, "2026-07-03": 1 }`
  (cached ~5 min).

---

### 12.D Subjects (`SubjectsController`, base `/v1/subjects`) — ✅ (scan ⛔)

**Subject DTO** (returned by list/get/create/update):
```json
{
  "id":"uuid", "name":"Calculus", "code":"MATH101", "color_hex":"#4F8DFD",
  "semester_id":"uuid", "credits":4, "prof":"Dr. X", "target_grade":"A",
  "mood":3, "files_count":2, "sort_order":0,
  "next_label":"Read chapter 3", "focus_label":"2 due today",
  "files":[ { "id":"uuid", "name":"syllabus.pdf", "size_label":"1.2 MB", "kind":"syllabus", "important":true } ]
}
```
> `next_label`/`focus_label` are **server-derived** (soonest upcoming occurrence
> title within 90 days; count due today). ⚠️ Provisional formula — confirm the
> exact copy against the app's `subject_dto.dart` if it differs.

#### `GET /v1/subjects?semester_id=` — bearer
- **Purpose:** Subjects list (Subjects tab). `semester_id` **optional** (⚠️ spec
  says required) — filters to one term; omit for all.
- **Output 200:** `{ "subjects": [ <Subject DTO>, ... ] }` (ordered by `sort_order`, then name).

#### `GET /v1/subjects/:id` — bearer
- **Output 200:** a single `<Subject DTO>`. **Errors:** `404 "Subject not found"`.

#### `POST /v1/subjects` — bearer
- **Input body:**

| field | type | req | rules |
|---|---|---|---|
| `name` | string | ✓ | 1–120 |
| `color_hex` | string | ✓ | `#RRGGBB` |
| `semester_id` | string | | defaults to active semester (auto-creates one if none) |
| `code` | string | | |
| `credits` | number | | |
| `prof` | string | | |
| `target_grade` | string | | free-form |
| `mood` | int | | 0–4 |

- **Output 201:** `<Subject DTO>` (`files: []`). **Errors:** `422 "Unknown semester_id"`.

#### `PATCH /v1/subjects/:id` — bearer
- **Input body:** any subset of the create fields (all optional).
- **Output 200:** updated `<Subject DTO>`.

#### `PATCH /v1/subjects/reorder` — bearer
- **Purpose:** Persist drag-reorder. ⚠️ body not in spec.
- **Input body:** `{ "ids": ["subjectId1","subjectId2", ...] }` (full ordered list,
  ≥1). Server sets `sort_order = index`.
- **Output 200:** `{ "subjects": [ ... ] }` (the full re-ordered list).
- **Errors:** `422 "Unknown subject ids: ..."`.

#### `DELETE /v1/subjects/:id` — bearer
- **Output 200:** `{ "status":"deleted", "id":"uuid" }` (soft delete).

#### `POST /v1/subjects/:id/files` — bearer
- **Purpose:** Attach **metadata-only** file record (no binary; use §9.1 for real
  uploads). ⚠️ body not in spec.
- **Input body:** `{ name?:string, kind?:"syllabus|slides|notes|paper", important?:boolean }`.
- **Output 201:** `{ "id":"uuid", "name":"...", "kind":"notes", "important":false }`.

#### `POST /v1/subjects/:id/files/scan` — bearer — ⛔ NOT IMPLEMENTED
- Throws (500) — OCR scan needs a Vision provider. Mock on the client.

---

### 12.E Semesters (`SemestersController`, base `/v1/semesters`) — ✅

**Semester DTO:** `{ "id":"uuid", "name":"Fall 2026", "start":"2026-09-01", "end":"2026-12-20", "is_active":true }`.
(There is **no bulk semester create**; bulk **subject** create is via
`/onboarding/complete`, §12.B.)

#### `GET /v1/semesters` — bearer
- **Output 200:** `{ "semesters": [ <Semester DTO>, ... ] }` (newest start first).

#### `GET /v1/semesters/active` — bearer
- **Purpose:** The single current term (self-heals if unset).
- **Output 200:** one `<Semester DTO>`. **Errors:** `404 "No semesters yet"`.

#### `POST /v1/semesters` — bearer
- **Input body:** `{ name:1–120, start:"yyyy-MM-dd", end:"yyyy-MM-dd" }`.
- **Output 201:** `<Semester DTO>` (first semester auto-becomes active).
- **Errors:** `422 "`start` must be on or before `end`"`.

#### `PATCH /v1/semesters/:id` — bearer
- **Input body:** any subset of `{ name?, start?, end? }`.
- **Output 200:** updated `<Semester DTO>`.

#### `PATCH /v1/semesters/:id/activate` — bearer
- **Purpose:** Make this the single active term. **Input:** none.
- **Output 200:** the now-active `<Semester DTO>`.

#### `DELETE /v1/semesters/:id` — bearer
- **Output 200:** `{ "status":"deleted", "id":"uuid" }` (soft delete).
- **Errors:** `409 "Cannot delete the last semester"`.

---

### 12.F Files (`FilesController`, root-level) — ✅ (thumbnail ⛔; 501 if GCS unset)

See §9 for the full flow, the `PUT`-to-GCS contract, and the 501-when-unconfigured
behavior.

- **`POST /v1/uploads/init`** — bearer. Body `{ subject_id, name(1–255), kind?, mime_type?, size_bytes? }`
  → `{ "file_id":"uuid", "upload_url":"https://storage.googleapis.com/...signed", "key":"quarantine/users/.../file.pdf" }`.
  Errors: `404 "Subject not found"`, `501`.
- **`POST /v1/uploads/staging/init`** — bearer. ⚠️ body not in spec.
  Body `{ name(1–255), kind?, mime_type?, size_bytes? }`
  → `{ "upload_id":"uuid", "upload_url":"...signed", "key":"...", "name":"syllabus.pdf", "mime_type":"application/pdf" }`.
- **`POST /v1/uploads/:id/commit`** — bearer (`:id` = `file_id`).
  → **File DTO**:
```json
{ "id":"uuid", "name":"syllabus.pdf", "kind":"syllabus", "important":false,
  "mime_type":"application/pdf", "size_bytes":123456, "scan_status":"clean",
  "ocr_status":"none", "created_at":"2026-07-04T09:12:33.000Z" }
```
- **`PATCH /v1/files/:id`** — bearer. Body `{ important?:boolean, name?:1–255 }` → File DTO.
- **`DELETE /v1/files/:id`** — bearer → `{ "status":"deleted", "id":"uuid" }`.
- **`GET /v1/files/:id/download`** — bearer → `{ "url":"...signed read url", "expires_in":300 }`. Errors `404`.
- **`GET /v1/files/:id/thumbnail`** — ⛔ NOT IMPLEMENTED (501).

---

### 12.G Focus sessions (`FocusController`, base `/v1/focus-sessions`) — ✅

See §8.4 for the live-timer model (client-local tick; no `focus:tick`).

**Focus DTO:**
```json
{ "id":"uuid", "planned_min":25, "elapsed_sec":0, "status":"RUNNING",
  "prism_mode":"rain", "task_id":"series-uuid", "task_date":"2026-07-04",
  "mood_index":null, "created_at":"2026-07-04T09:12:33.000Z" }
```

#### `POST /v1/focus-sessions` — bearer
- **Purpose:** Start a Pomodoro (Focus screen).
- **Input body (all optional):**

| field | type | rules |
|---|---|---|
| `planned_min` | int | 5–120 (default 25) |
| `prism_mode` | string | a Prism key (§11) |
| `task_id` | string | linked **series id** (for done-sync) |
| `task_date` | string | `yyyy-MM-dd` of the linked occurrence |

- **Output 201:** Focus DTO (`status:"RUNNING"`).

#### `PATCH /v1/focus-sessions/:id` — bearer
- **Purpose:** Checkpoint progress / pause / resume.
- **Input body:** `{ elapsed_sec?:int≥0, status?:"RUNNING"|"PAUSED" }`.
- **Output 200:** Focus DTO. **Errors:** `404 "Focus session not found"`.

#### `POST /v1/focus-sessions/:id/complete` — bearer
- **Purpose:** Finish; optionally capture end-mood and done-sync the linked task.
- **Input body:** `{ elapsed_sec?:int≥0, mood_index?:0–4 }`.
- **Output 201:** Focus DTO (`status:"COMPLETE"`) **plus** `linked_task`:
```json
{ "id":"...", "planned_min":25, "elapsed_sec":1500, "status":"COMPLETE",
  "prism_mode":"rain", "task_id":"series-uuid", "task_date":"2026-07-04", "mood_index":3,
  "created_at":"...", "linked_task": { /* occurrence DTO, or null if none/failed */ } }
```

---

### 12.H Mood (`MoodController`, base `/v1/mood-entries`) — ✅

**Mood DTO:** `{ "date":"2026-07-04", "mood_index":3, "intention":"focus", "reflection":"good day" }`
(any field may be `null`). Writes merge asymmetrically: logging mood preserves an
existing reflection and vice-versa. Each write feeds the streak.

#### `POST /v1/mood-entries` — bearer
- **Purpose:** Morning check-in / ad-hoc mood log.
- **Input body:** `{ date:"yyyy-MM-dd"(req), mood_index:0–4(req), intention?:0–2000 }`.
- **Output 201:** Mood DTO.

#### `POST /v1/mood-entries/:date/reflection` — bearer
- **Purpose:** Evening reflection. `:date` = `yyyy-MM-dd`.
- **Input body:** `{ "reflection": "string 0–4000" }`.
- **Output 201:** Mood DTO (mood/intention preserved).

#### `GET /v1/mood-entries/:date` — bearer
- **Output 200:** Mood DTO, or `{ "date":"...", "mood_index":null, "intention":null, "reflection":null }` if none.

#### `GET /v1/mood-entries/week?date=` — bearer
- **Purpose:** Week strip (Mon-start). `date` optional (defaults today).
- **Output 200:** `{ "week_start":"2026-06-29", "days":[ <Mood DTO> x7 ] }` (index 0 = Monday).

#### `GET /v1/mood-entries/today?field=` — bearer
- **Purpose:** Drive check-in prompts. `field` optional: `mood` | `reflection` | (omit = both).
- **Output 200:** `{ "today_mood_logged":true, "today_reflection_logged":false }` (or the single
  requested boolean when `field` is set).

---

### 12.I Streaks & activity (`StreaksController` + `ActivityController`) — ✅

Server-authoritative; computed from the activity ledger (task completions ∪ mood
logs). The client streak is never trusted.

- **`GET /v1/streaks/current`** — bearer →
  `{ "current_streak":5, "today_has_activity":true, "total_active_days":42 }`.
- **`GET /v1/activity-dates`** — bearer (root path) →
  `{ "dates": ["2026-06-30","2026-07-01","2026-07-04"] }` (sorted union of active days).
- **`GET /v1/week-count?date=`** — bearer (root path). `date` optional (⚠️ spec says
  required). → `{ "week_start":"2026-06-29", "count":3 }`.
- **`GET /v1/today-has-activity`** — bearer (root path) → `{ "today_has_activity":true }`.

---

### 12.J Profile & stats — ✅

#### `GET /v1/profile` — bearer (`ProfileController`)
- **Output 200** (Profile DTO):
```json
{ "name":"Ada", "email":"a@b.com", "is_guest":false, "gender":"female",
  "date_of_birth":"2003-05-01", "university":"MIT", "program":"CS", "avatar_index":2 }
```

#### `PATCH /v1/profile` — bearer
- **Input body (all optional):**

| field | type | rules |
|---|---|---|
| `name` | string | 0–120 |
| `gender` | string | 0–40 |
| `date_of_birth` | string | `yyyy-MM-dd` |
| `university` | string | 0–200 |
| `program` | string | 0–200 |
| `avatar_index` | int | **0–7** (preset avatar; no photo upload) |

- **Output 200:** Profile DTO.

#### `GET /v1/me/stats` — bearer (`StatsController`)
- **Purpose:** Aggregated Profile/Stats screen.
- **Output 200:**
```json
{ "current_streak":5, "total_active_days":42, "completed_tasks":128,
  "focus_minutes":540, "focus_sessions":30, "subjects_count":6 }
```
  (`focus_minutes` = summed `elapsed_sec` of completed sessions ÷ 60. There is no
  separate "weekly focus minutes" or "week moods" field — build weekly views from
  `/mood-entries/week`, `/week-count`, and `/tasks/history/completions`.)

---

### 12.K Settings (`SettingsController`, base `/v1/me`) — ✅

**Theme/appearance is server-owned** in `settings.theme_mode` (persisted + synced);
the client may cache locally but should treat the server value as source of truth.

#### `GET /v1/me/settings` — bearer
- **Output 200** (Settings DTO, defaults shown):
```json
{ "theme_mode":"system", "prism_default_mode":null, "notification_sound":"Chime",
  "notification_time":"07:00", "notification_time_morning":"08:00",
  "notification_time_review":"20:00", "daily_focus_goal_min":120,
  "work_best_times":null, "education_level":null }
```

#### `PATCH /v1/me/settings` — bearer
- **Input body (all optional):**

| field | type | rules |
|---|---|---|
| `theme_mode` | string | `light|dark|system` |
| `prism_default_mode` | string | Prism key |
| `notification_sound` | string | `Chime|Pulse|Glass|Drop|None` |
| `notification_time` | string | `HH:MM` |
| `notification_time_morning` | string | `HH:MM` |
| `notification_time_review` | string | `HH:MM` |
| `daily_focus_goal_min` | int | 0–1440 |
| `work_best_times` | any (JSON) | opaque |
| `education_level` | string | |

- **Output 200:** full Settings DTO.

#### `GET /v1/me/email-preferences` — bearer
- **Output 200:** `{ "product_updates":true, "study_tips":true, "offers":false, "surveys":false }`.

#### `PATCH /v1/me/email-preferences` — bearer
- **Input body (all optional booleans):** `product_updates`, `study_tips`, `offers`, `surveys`.
- **Output 200:** full email-prefs DTO.

#### `GET /v1/me/notification-preferences` — bearer
- **Output 200:**
```json
{ "notification_sound":"Chime", "notification_time":"07:00",
  "notification_time_morning":"08:00", "notification_time_review":"20:00",
  "channels":[ { "channel_key":"morning", "enabled":true, "send_time":"08:00" } ] }
```

#### `PATCH /v1/me/notification-preferences` — bearer
- **Input body (all optional):** `notification_sound` (enum), `notification_time`,
  `notification_time_morning`, `notification_time_review` (all `HH:MM`).
- **Output 200:** the notification-preferences DTO (as GET above).

#### `GET /v1/me/notification-channels` — bearer
- **Output 200:** `{ "channels":[ { "channel_key":"morning", "enabled":true, "send_time":"08:00" } ] }`.

#### `PUT /v1/me/notification-channels` — bearer
- **Purpose:** Upsert the channel matrix (replace semantics per channel).
- **Input body:** `{ "channels":[ { "channel_key":string(req), "enabled":bool(req), "send_time?":"HH:MM" } ] }`.
- **Output 200:** `{ "channels":[ ... ] }`.

#### `GET /v1/me/export` — bearer
- **Purpose:** Data export (GDPR-ish). **Output 200:** a large object:
```json
{ "exported_at":"2026-07-04T09:12:33.000Z", "profile":{...}, "settings":{...},
  "email_preferences":{...}, "semesters":[...], "subjects":[...],
  "task_series":[ { ...series, "overrides":[...], "steps":[...] } ],
  "mood_entries":[...], "study_tags":[...], "notification_channels":[...] }
```
  (Raw DB rows, not the trimmed DTOs — for download/backup, not for rendering.)

---

### 12.L Study tags (`TagsController`, base `/v1/study-tags`) — ✅

**Tag DTO:** `{ "id":"uuid", "label":"Exam", "color":"#FF5C7C" }`.

- **`GET /v1/study-tags`** — bearer → `{ "tags":[ <Tag DTO>, ... ] }`. Seeds 7
  defaults (Lecture, Class, Exam, Assignment, Report, Presentation, Reading) on
  first access.
- **`POST /v1/study-tags`** — bearer. Body `{ label:1–60(req), color?:"#RRGGBB" }`
  (default color `#8E8E93`). Case-insensitive dedup (idempotent). → `<Tag DTO>`.
- **`DELETE /v1/study-tags/:label`** — bearer. `:label` is the label text
  (case-insensitive). → `{ "status":"deleted", "label":"Exam" }`. Errors `404 "Tag not found"`.

---

### 12.M Prism modes (`PrismController`) — ✅

- **`GET /v1/prism-modes`** — bearer. Soundscape catalog for the Prism picker.
- **Output 200:**
```json
{ "modes":[
  { "key":"none", "label":"No sound", "description":"Silence", "url":null },
  { "key":"rain", "label":"Rain", "description":"Steady rainfall", "url":"https://storage.googleapis.com/<bucket>/prism/rain.m3u8" },
  { "key":"forest", "label":"Forest", "description":"Woodland ambience", "url":"..." },
  { "key":"cafe", "label":"Café", "description":"Warm coffee-shop murmur", "url":"..." },
  { "key":"whitenoise", "label":"White noise", "description":"Even broadband noise", "url":"..." }
] }
```
  `url` is a **HLS `.m3u8`** stream on the public CDN, or **`null`** until
  `GCS_PRISM_CDN_BUCKET`/`PRISM_CDN_BASE_URL` is configured (render `none` +
  disable playback when null).

---

### 12.N Devices (`DevicesController`, base `/v1/devices`) — ✅

Push-token registry. The FCM token comes from Firebase Messaging on the client
(Firebase is used **only** for this, not auth). IANA `timezone` drives local
reminder delivery.

**Device DTO:** `{ "id":"uuid", "push_token":"...", "platform":"android", "token_provider":"fcm", "timezone":"Asia/Kolkata", "permission":"granted", "revoked":false }`.

- **`POST /v1/devices`** — bearer. Register/re-register (idempotent on `push_token`).
  Body:

| field | type | req | rules |
|---|---|---|---|
| `push_token` | string | ✓ | 1–512 |
| `platform` | string | ✓ | `ios|android` |
| `token_provider` | string | ✓ | `apns|fcm` |
| `timezone` | string | ✓ | IANA (validated) |
| `permission` | string | | `granted|denied|provisional` (default `granted`) |

  → Device DTO. Errors `422 "Invalid IANA timezone: ..."`.
- **`PATCH /v1/devices/:id`** — bearer. Body `{ push_token?, timezone?, permission? }` → Device DTO.
- **`POST /v1/devices/:id/heartbeat`** — bearer. Body `{ timezone? }` (also un-revokes).
  → `{ "status":"ok", "id":"uuid" }`.
- **`DELETE /v1/devices/:id`** — bearer → `{ "status":"revoked", "id":"uuid" }` (stops delivery).

---

### 12.O Notifications (`NotificationsController`, base `/v1/me/notifications`) — 🟡

**Notification DTO:** `{ "id":"uuid", "channel_key":"morning", "status":"sent", "read":false, "created_at":"2026-07-04T09:12:33.000Z" }`.

- **`GET /v1/me/notifications/history`** — bearer → `{ "notifications":[ <DTO> ] }` (≤100, newest first).
- **`GET /v1/me/notifications/inbox`** — bearer → `{ "notifications":[ <DTO> ], "unread_count":2 }`.
- **`POST /v1/me/notifications/test`** — bearer → sends a test push to the newest
  device and returns `{ ...<DTO>, "provider":"fcm", "error":null }`. Errors
  `400 "No registered device..."`.
- **`POST /v1/me/notifications/sweep?force=`** — bearer (test/debug). `force`
  optional: `morning|review`. → `{ "enqueued": 1 }`.

> **⚠️ MISSING: mark-as-read.** There is **no** endpoint to mark a notification
> read (the `read` flag exists on the DTO but is never mutated by any route).
> Treat "mark read" as **NOT IMPLEMENTED** — mock locally; a `PATCH
> /me/notifications/:id/read` (or bulk) needs to be added backend-side.

---

### 12.P Ada / AI (`AdaController`, base `/v1/ada`) — ✅ (plan-week needs AI)

See §10 for transport (plain JSON, non-streaming) and the safety gate.

**Conversation DTO:** `{ "id":"uuid", "title":"Weekly plan", "is_active":true, "created_at":"...", "last_message_at":"..." }`.
**Message DTO:** `{ "id":"uuid", "is_user":false, "text":"...", "plan":<array|null>, "plan_footer":"Added to your plan ✓"|null, "attachments":<array|null>, "created_at":"..." }`.

#### `POST /v1/ada/conversations` — bearer
- Body `{ title?:1–200 }` → Conversation DTO.

#### `GET /v1/ada/conversations` — bearer
- → `{ "conversations":[ <Conversation DTO>, ... ] }` (newest activity first).

#### `GET /v1/ada/conversations/:id/messages` — bearer
- → `{ "messages":[ <Message DTO>, ... ] }` (chronological). Errors `404 "Conversation not found"`.

#### `POST /v1/ada/conversations/:id/messages` — bearer
- **Purpose:** Send a chat turn; get Ada's reply (blocks until complete).
- **Input body:**
```json
{ "text":"Plan my week", "attachments":[ { "key":"quarantine/users/.../ada/...", "name":"syllabus.pdf", "mime_type":"application/pdf" } ] }
```
  `text` 1–8000 (req); `attachments` optional (from §9.3).
- **Output 201:** **both** messages: `{ "messages":[ <userMsg>, <assistantMsg> ] }`.
  If AI unconfigured, `assistantMsg.text` is a placeholder and `plan` is `null`.
  If the model proposes a plan, `assistantMsg.plan` is the day array + `plan_footer`.

#### `POST /v1/ada/conversations/:cid/messages/:mid/apply-plan` — bearer
- **Purpose:** User confirms a proposed plan → validate + create tasks (safety gate).
- **Input:** none (the plan is read from message `:mid`).
- **Output 201:** `{ "applied":3, "tasks":[ <occurrence DTO>, ... ] }`.
- **Errors:** `404 "Message not found"`; `422 "Message has no applicable plan"`;
  `422 { "message":"Plan validation failed", "errors":["task[0]: missing title", "unknown subject_id: ..."] }`.

#### `POST /v1/ada/plan-week` — bearer — 🟡 (501 without AI)
- **Purpose:** Onboarding "adaload" / on-demand "plan my week".
- **Input body:** `{ start_date?:"yyyy-MM-dd", goal?:0–500 }`. ⚠️ body not in spec.
- **Output 201:** `{ "conversation_id":"uuid", "start_date":"2026-07-04", "end_date":"2026-07-10", "applied":7, "tasks":[ ... ] }`.
- **Errors:** `501` if no AI provider; `422 "Ada returned an empty plan"` /
  `"Ada couldn't generate a plan right now..."`.

#### `POST /v1/ada/uploads` — bearer
- **Purpose:** Presign an Ada chat attachment. ⚠️ body not in spec. See §9.3.
- **Input body:** `{ conversation_id(req), name(1–255,req), mime_type?, size_bytes? }`.
- **Output 201:** `{ "file_id":"uuid", "upload_url":"...signed", "key":"...", "name":"syllabus.pdf" }`. Errors `501` if GCS unset.

#### `POST /v1/ada/conversations/:id/archive` — bearer
- → `{ "status":"archived", "id":"uuid" }`.

#### `POST /v1/ada/chat/clear` — bearer
- Archives all active conversations. → `{ "status":"cleared" }`.

---

### 12.Q Sync (`SyncController`, base `/v1/sync`)

Full detail in §8.2. Summary:
- **`GET /v1/sync/cursor`** — bearer ✅ → `{ "cursor": <epoch ms> }`.
- **`GET /v1/sync/changes?since=&from=&to=`** — bearer ✅ (all params optional) → delta envelope (§8.2).
- **`POST /v1/sync/mutations`** — bearer ⛔ **NOT IMPLEMENTED** (501).

---

### 12.R Referrals (`ReferralsController`, base `/v1/referrals`) — 🟡

- **`POST /v1/referrals/redeem`** — bearer. Body `{ "code":"4–32 chars" }` →
  `{ "status":"redeemed", "referrer_user_id":"uuid" }`. Records attribution
  intent only (reward ledger is P2). Errors `422 "Invalid referral code"`,
  `400 "You cannot redeem your own code"`.
- **`GET /v1/referrals/rewards/balance`** — bearer → `{ "code":"AB12CD34", "balance":0, "redemptions":0 }`
  (own shareable code; balance/redemptions always 0 until the ledger ships).

---

### 12.S Integrations (`IntegrationsController`, base `/v1/integrations`) — ⛔ NOT IMPLEMENTED

- **`POST /v1/integrations/calendar/ics`** — bearer — ⛔ throws (500). Intended: ICS subscription import.
- **`POST /v1/integrations/google/oauth/callback`** — bearer — ⛔ throws (500). Intended: Google Calendar import (Apple calendar is on-device).

Mock both on the client until implemented.

---

### 12.T Feedback / ratings / telemetry (`FeedbackController`, root) — ✅ (fire-and-forget)

- **`POST /v1/ratings`** — bearer. Body `{ rating:1–5(req), comment?:0–2000 }` → `{ "status":"received" }`.
- **`POST /v1/feedback`** — bearer. Body `{ text:1–5000(req) }` → `{ "status":"received" }`.
- **`POST /v1/telemetry/events`** — bearer. Body `{ events:[ { ...arbitrary object } ] }` → `{ "accepted": <count> }`.
  Events are counted, **not persisted** (warehouse wiring is later).

---

### 12.U Health / ops (`HealthController`, root) — ✅ (public)

- **`GET /v1/healthz`** — public → `{ "status":"ok" }` (liveness).
- **`GET /v1/readyz`** — public → `{ "status":"ready", "db":"ok", "redis":"ok" }`,
  or **503** `{ "status":"not_ready", "db":"down", "redis":"ok" }` if a dep is down.
- **`GET /v1/metrics`** — public → Prometheus text (`text/plain`). Not for the app.
- **`POST /v1/debug/sql-smoke-test`** — public but **env-gated** (`403` unless
  `ENABLE_SQL_SMOKE_TEST=1`). Debug only — the client should never call it.

---

## 13. Known frontend ↔ backend mismatches (authoritative answers)

### Mismatch 1 — Auth: drop Identity Platform / Firebase Auth
**Answer: YES, remove `firebase_auth` for authentication entirely.** Use this
backend's REST JWT flow (§3). Replacement map:

| Old (Firebase) | New (this backend) |
|---|---|
| `signInAnonymously()` | `POST /v1/auth/guest` |
| email/password sign-up + email verification | `POST /v1/auth/signup` → `POST /v1/auth/verify-otp` (6-digit OTP, not email link) |
| email/password sign-in | `POST /v1/auth/signin` |
| Google/Apple provider sign-in | `POST /v1/auth/sso/google` / `.../sso/apple` (post the provider **ID token**) |
| `linkWithCredential()` (anon → real) | `POST /v1/auth/link-guest` → `POST /v1/auth/verify-otp` |
| Firebase ID token / auto refresh | store `access_token`+`refresh_token`; attach Bearer; refresh via `POST /v1/auth/refresh` on 401 |
| `signOut()` | `POST /v1/auth/signout` (+ discard tokens) |
Keep Firebase **only** for FCM push tokens → `POST /v1/devices` (`token_provider:"fcm"`).

### Mismatch 2 — Realtime: there is no `focus:tick`
**Answer:** The only socket is `/me/revisions` emitting `connected` and
`revision` events (§8.1). Live updates = **revision signal → `GET /sync/changes`
refetch** (§8.3). The **focus timer ticks client-side**; persist via
`PATCH /focus-sessions/:id` checkpoints and finalize via `.../complete`
(§8.4). Remove any `focus:tick` listener.

### Mismatch 3 — Repeat rules: full enum + interval/weekday encoding
**Answer:** The wire enum is **8 values** (client's `custom` maps to the `everyN*`
family):

| Client concept | Wire `repeat.kind` (+`interval`) |
|---|---|
| None | `none` |
| Daily | `daily` |
| Weekdays (Mon–Fri) | `weekdays` |
| Weekly | `weekly` (fires on the **anchor date's weekday**) |
| Monthly | `monthly` (same day-of-month, **clamped** to month end) |
| Every N days | `everyNDays` + `interval:N` |
| Every N weeks | `everyNWeeks` + `interval:N` (on the anchor weekday) |
| Every N months | `everyNMonths` + `interval:N` (same clamped day-of-month) |

- **`interval`** is an int 1–365 (default 1), only meaningful for the `everyN*`
  kinds. **There is no weekday-set array** and no "on days [Mon,Wed]" concept —
  the recurring weekday is derived from the series `anchor_date` (the task's
  `date`). To model "every Tuesday", create the series with `date` on a Tuesday +
  `repeat.kind:"weekly"`. `until_date` bounds the recurrence.

### Mismatch 4 — Route/name drift (confirmed real routes)
| Concept | **Real route** |
|---|---|
| Study tags | `/v1/study-tags` (delete by **label**, not id) |
| Mood | `/v1/mood-entries` (+ `/week`, `/today`, `/:date`, `/:date/reflection`) |
| Stats | `/v1/me/stats` |
| Focus | `/v1/focus-sessions` |
| Settings | `/v1/me/settings`, `/v1/me/email-preferences`, `/v1/me/notification-preferences`, `/v1/me/notification-channels`, `/v1/me/export` |
| Notifications | `/v1/me/notifications/{history,inbox,test,sweep}` |
| Activity | root-level `/v1/activity-dates`, `/v1/week-count`, `/v1/today-has-activity` |
| Streak | `/v1/streaks/current` |
| Subject reorder | `PATCH /v1/subjects/reorder` (body `{ids:[...]}`) |
| Semester activate | `PATCH /v1/semesters/:id/activate` |
| Files | init `/v1/uploads/init`, staging `/v1/uploads/staging/init`, commit `/v1/uploads/:id/commit`, then `/v1/files/:id*` |

### Mismatch 5 — Occurrence identity, targeting, timezone
- **Occurrence id format:** `"{series_id}@{yyyy-MM-dd}"` (e.g.
  `3f2a...@2026-07-04`). Always pass this exact string to
  toggle/patch/delete/move.
- **Single occurrence vs series:** `toggle`, `patch`, `delete`, and `move` affect
  **only the named occurrence** (backed by an `OccurrenceOverride` row). `create`
  (`POST /tasks`) creates the **series**. **There is no endpoint to edit the
  whole series** (title/subject/repeat of every future occurrence) — only
  per-occurrence overrides + create. Flag if the UI needs bulk-series edit.
- **Day/timezone semantics:** recurrence math is **UTC-day precision**. Request a
  day with `GET /tasks?date=yyyy-MM-dd` using the **calendar date the user is
  viewing**; display the time-of-day from each occurrence's `scheduled_at`
  (naive wall-clock). Do not convert the `date` param to UTC yourself — send the
  plain calendar date.

---

## 14. Screen / repository → endpoint map

Every client data-source operation mapped to its endpoint(s)/event. State: ✅ live · 🟡 partial · ⛔ stub.

### AuthRepository / SessionRepository
| Operation | Endpoint | State |
|---|---|---|
| Guest sign-in | `POST /v1/auth/guest` | ✅ |
| Sign up | `POST /v1/auth/signup` | ✅ |
| Verify OTP | `POST /v1/auth/verify-otp` | ✅ |
| Resend OTP | `POST /v1/auth/resend-otp` | ✅ |
| Sign in | `POST /v1/auth/signin` | ✅ |
| SSO Google / Apple | `POST /v1/auth/sso/google` · `.../sso/apple` | ✅ |
| Refresh tokens | `POST /v1/auth/refresh` | ✅ |
| Sign out | `POST /v1/auth/signout` | ✅ |
| List sessions | `GET /v1/auth/sessions` | ✅ |
| Revoke session / all | `DELETE /v1/auth/sessions/:id` · `POST /v1/auth/sessions/revoke-all` | ✅ |
| Link guest → account | `POST /v1/auth/link-guest` → `verify-otp` | ✅ |
| Change password | `POST /v1/auth/change-password` | ✅ |
| Change email | `POST /v1/auth/change-email/request` → `.../verify` | ✅ |
| Forgot password | `POST /v1/auth/forgot-password` → `/verify` → `/reset` | ✅ |
| Delete account | `DELETE /v1/auth/account` | ✅ |

### OnboardingRepository
| Operation | Endpoint | State |
|---|---|---|
| Submit onboarding | `POST /v1/onboarding/complete` | ✅ |
| Stage syllabus upload | `POST /v1/uploads/staging/init` (+ PUT) | ✅ |
| Kick off week plan (adaload) | `POST /v1/ada/plan-week` | 🟡 (needs AI) |

### TasksRepository (Plan)
| Operation | Endpoint | State |
|---|---|---|
| Load day / range | `GET /v1/tasks?date=` · `?from=&to=` | ✅ |
| Create task/series | `POST /v1/tasks` | ✅ |
| Toggle done | `PATCH /v1/tasks/:occ/toggle` | ✅ |
| Move occurrence(s) | `POST /v1/tasks/move` | ✅ |
| Edit occurrence | `PATCH /v1/tasks/:occ` | ✅ |
| Delete occurrence | `DELETE /v1/tasks/:occ` | ✅ |
| Weekly completed count (Stats) | `GET /v1/tasks/history/completions` (or `/v1/week-count`) | ✅ |
| Break into microsteps | `POST /v1/tasks/:occ/breakdown` | ✅ |

### SubjectsRepository / SemestersRepository
| Operation | Endpoint | State |
|---|---|---|
| List subjects | `GET /v1/subjects?semester_id=` | ✅ |
| Subject detail | `GET /v1/subjects/:id` | ✅ |
| Create / update subject | `POST /v1/subjects` · `PATCH /v1/subjects/:id` | ✅ |
| Reorder subjects | `PATCH /v1/subjects/reorder` | ✅ |
| Bulk create subjects | `POST /v1/onboarding/complete` (no dedicated bulk route) | ✅ |
| Delete subject | `DELETE /v1/subjects/:id` | ✅ |
| Attach file metadata | `POST /v1/subjects/:id/files` | ✅ |
| Scan file (OCR) | `POST /v1/subjects/:id/files/scan` | ⛔ |
| List / create / update semester | `GET/POST /v1/semesters` · `PATCH /v1/semesters/:id` | ✅ |
| Active semester / activate | `GET /v1/semesters/active` · `PATCH /v1/semesters/:id/activate` | ✅ |

### FilesRepository
| Operation | Endpoint | State |
|---|---|---|
| Upload subject file | `POST /v1/uploads/init` → PUT → `POST /v1/uploads/:id/commit` | ✅* |
| Download | `GET /v1/files/:id/download` | ✅* |
| Rename / star | `PATCH /v1/files/:id` | ✅ |
| Delete | `DELETE /v1/files/:id` | ✅ |
| Thumbnail | `GET /v1/files/:id/thumbnail` | ⛔ |
(*501 until `GCS_USER_BUCKET` is configured.)

### FocusRepository
| Operation | Endpoint / mechanism | State |
|---|---|---|
| Start session | `POST /v1/focus-sessions` | ✅ |
| Tick / pause / resume | **client-local tick** + `PATCH /v1/focus-sessions/:id` checkpoints | ✅ |
| Complete (+ end mood, done-sync) | `POST /v1/focus-sessions/:id/complete` | ✅ |
| Prism catalog | `GET /v1/prism-modes` | ✅ |

### MoodRepository
| Operation | Endpoint | State |
|---|---|---|
| Log mood (morning/adhoc) | `POST /v1/mood-entries` | ✅ |
| Reflection (evening) | `POST /v1/mood-entries/:date/reflection` | ✅ |
| Day / week reads | `GET /v1/mood-entries/:date` · `/week` | ✅ |
| Today check-in flags | `GET /v1/mood-entries/today` | ✅ |

### StreaksRepository
| Operation | Endpoint | State |
|---|---|---|
| Current streak | `GET /v1/streaks/current` | ✅ |
| Activity dates | `GET /v1/activity-dates` | ✅ |
| Week count | `GET /v1/week-count` | ✅ |
| Today has activity | `GET /v1/today-has-activity` | ✅ |

### ProfileRepository / SettingsRepository
| Operation | Endpoint | State |
|---|---|---|
| Get / update profile | `GET/PATCH /v1/profile` | ✅ |
| Aggregated stats | `GET /v1/me/stats` | ✅ |
| Settings get/update | `GET/PATCH /v1/me/settings` | ✅ |
| Theme / appearance | `theme_mode` in `/v1/me/settings` (server-owned) | ✅ |
| Email prefs | `GET/PATCH /v1/me/email-preferences` | ✅ |
| Notification prefs / channels | `GET/PATCH /v1/me/notification-preferences` · `GET/PUT /v1/me/notification-channels` | ✅ |
| Data export | `GET /v1/me/export` | ✅ |
| Study tags | `GET/POST /v1/study-tags` · `DELETE /v1/study-tags/:label` | ✅ |

### DevicesRepository / NotificationsRepository
| Operation | Endpoint | State |
|---|---|---|
| Register / update / heartbeat / delete device | `POST /v1/devices` · `PATCH/POST/DELETE /v1/devices/:id` | ✅ |
| Notification history / inbox | `GET /v1/me/notifications/history` · `/inbox` | ✅ |
| Test push | `POST /v1/me/notifications/test` | ✅ |
| Mark read | _(none)_ | ⛔ missing |

### AdaRepository
| Operation | Endpoint | State |
|---|---|---|
| Create / list conversations | `POST/GET /v1/ada/conversations` | ✅ |
| List messages | `GET /v1/ada/conversations/:id/messages` | ✅ |
| Send message (+ attachments) | `POST /v1/ada/conversations/:id/messages` | ✅ |
| Upload attachment | `POST /v1/ada/uploads` (+ PUT) | ✅* |
| Apply proposed plan | `POST /v1/ada/conversations/:cid/messages/:mid/apply-plan` | ✅ |
| Plan my week | `POST /v1/ada/plan-week` | 🟡 (needs AI) |
| Archive / clear | `POST /v1/ada/conversations/:id/archive` · `POST /v1/ada/chat/clear` | ✅ |

### SyncRepository (offline)
| Operation | Endpoint / event | State |
|---|---|---|
| Open revision stream | Socket.IO `/me/revisions` (`connected`, `revision`) | ✅ |
| Get cursor | `GET /v1/sync/cursor` | ✅ |
| Pull delta | `GET /v1/sync/changes?since=` | ✅ |
| Batch push mutations | `POST /v1/sync/mutations` | ⛔ (use per-feature + Idempotency-Key) |

### Misc (Referrals / Integrations / Feedback)
| Operation | Endpoint | State |
|---|---|---|
| Redeem code / reward balance | `POST /v1/referrals/redeem` · `GET /v1/referrals/rewards/balance` | 🟡 |
| Import ICS / Google Calendar | `POST /v1/integrations/calendar/ics` · `.../google/oauth/callback` | ⛔ |
| Rate / feedback / telemetry | `POST /v1/ratings` · `/v1/feedback` · `/v1/telemetry/events` | ✅ |

---

## 15. Summary of NOT-IMPLEMENTED / partial (mock these client-side)

| Endpoint | Status | Behavior |
|---|---|---|
| `POST /v1/subjects/:id/files/scan` | ⛔ | throws 500 (OCR provider missing) |
| `GET /v1/files/:id/thumbnail` | ⛔ | 501 |
| `POST /v1/sync/mutations` | ⛔ | 501 (use per-feature endpoints) |
| `POST /v1/integrations/calendar/ics` | ⛔ | throws 500 |
| `POST /v1/integrations/google/oauth/callback` | ⛔ | throws 500 |
| mark-notification-read | ⛔ | no route exists |
| `POST /v1/ada/plan-week` | 🟡 | 501 unless AI configured |
| all `/uploads*`, `/files/*/download`, `/ada/uploads` | 🟡 | 501 unless `GCS_USER_BUCKET` set |
| `POST /v1/referrals/redeem`, `GET /v1/referrals/rewards/balance` | 🟡 | works, but no reward ledger (balance always 0) |
| `POST /v1/telemetry/events`, `/ratings`, `/feedback` | 🟡 | accepted but not persisted to a store |
| edit-whole-series (task) | ⛔ | only per-occurrence overrides exist |


