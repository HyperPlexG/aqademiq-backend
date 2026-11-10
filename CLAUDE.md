# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The deployed backend is `supabase/functions/`, not `src/`

The migration from NestJS/GCP to **Deno + Hono on Supabase Edge Functions** is
**complete** (all 21 routers + services ported; no `TODO(§x)` markers remain).
`supabase/functions/api/` is what serves production traffic; `src/` is the
readable NestJS reference, still built and tested in CI. Port behaviour *from*
`src/features/*` — do not assume it is live. Key decisions from the port:
- **Vertex AI is kept** for Claude inference, via hand-rolled REST
  (`supabase/functions/_shared/vertex.ts` — SA-JWT signed with Web Crypto, no Node SDK).
- **Auth is Supabase Auth** (switched 2026-07-18, superseding the earlier keep-custom-JWT decision):
  the app verifies Supabase ES256 access tokens against the project JWKS (`src/common/supabase-jwt.ts`,
  requires `SUPABASE_URL`). The custom RS256 `TokenService` + `/v1/auth/*` endpoints were removed;
  guest = Supabase anonymous sign-in (`is_anonymous` claim).
- BullMQ → Postgres `job_queue` + pg_cron worker; Socket.IO → Supabase Realtime Broadcast; ioredis → Upstash REST.
- Prisma upgraded to **6.x** with a second `edge` generator (`provider = "prisma-client"`,
  `runtime = "deno"`) emitting a gitignored client into `supabase/functions/_shared/prisma/`.
- URL shape: function `api` + Hono `basePath('/api/v1')` — clients keep `/v1/<resource>`
  paths on base URL `https://<ref>.supabase.co/functions/v1/api`.
- `supabase/functions/prisma-spike/` was the phase-1 gate (Prisma driver adapter
  inside a real Edge Function); it passed and is still deployed as a smoke test.
- **AI provider is `rotating` in production** — `_shared/ai.ts` round-robins a pool
  of Gemini-on-Vertex plus free-tier Gemini + Groq + Cerebras keys
  (`GEMINI_API_KEYS` / `GROQ_API_KEYS` / `CEREBRAS_API_KEYS`), adapting all of them
  to the Anthropic Messages shape.
  Providers are tried in `PROVIDER_PRIORITY` order — **vertex-gemini → gemini →
  groq → cerebras**.
- **Gemini on Vertex is the paid head of that pool**, present only when the
  `GCP_*` secrets are set (`VERTEX_GEMINI_MODEL`, default `gemini-3.8-flash` —
  2.5 Flash was retired on Vertex on 20 Oct 2026;
  `VERTEX_GEMINI_REGION`, default `global`). It exists to spend GCP credits, and
  the free keys stay behind it so an exhausted balance or broken billing fails
  over instead of taking Ada down.
  **`AI_PROVIDER=vertex` is a different thing** — it selects *Claude* on Vertex
  (`publishers/anthropic`, `_shared/vertex.ts`), a Marketplace-billed third-party
  model that GCP promotional credits commonly exclude. Leave `AI_PROVIDER` unset
  to get the pool. Gemini on Vertex is `publishers/google` and shares the request
  builder with the free AI Studio path (`buildGeminiBody`), so the two cannot drift.
- Remaining notes on the free tier:
  Gemini and Groq rate-limit and reset, while Cerebras has been answering 402
  (out of credit), so it is last. Groq and Cerebras share one OpenAI-compatible
  adapter (`openAiCompatChat`); Groq is the only one that sends `Retry-After`, and
  it is honoured over a guess.
  Groq model choice is constrained: `groq/compound` has 70K TPM but **rejects tool
  calling**, so Ada cannot use it. `openai/gpt-oss-120b` (default, 30 RPM / 1K RPD /
  **8K TPM** / 200K TPD) is the strongest tool-capable option. 8K TPM is the number
  to watch — one Ada call is ~4.9K tokens plus transcript, so a second call on the
  same key within a minute will 429; the per-key rotation is what makes that fine.
- **Free-tier quota is metered in REQUESTS, not tokens**, and per project per model
  — so turns-per-run is the binding constraint, and one key listed against two
  models in `GEMINI_MODELS` draws on two independent quotas. See
  [docs/AI_QUOTA_REPORT.md](docs/AI_QUOTA_REPORT.md). Edge knobs:
  `ADA_MAX_TURNS`/`ADA_MAX_LLM_CALLS` (4), `ADA_MAX_RESUME_TURNS` (2),
  `ADA_HISTORY_LIMIT` (16), `ADA_DAILY_CALL_CAP` (calls/user/UTC-day: 20 on the free pool, 200 with Claude direct, where the money cap binds; 0 = off),
  `GEMINI_MODELS`, `ADA_THINKING_BUDGET` (unset = Gemini 3 gets
  `GEMINI_THINKING_LEVEL`, older models the provider default; set = that budget
  for every Gemini model, 0 = no thinking where the model allows it).
- **Upstash Redis fails open** (`_shared/redis.ts`): rate limits, idempotency and
  the hard-tier spend cap switch off for any request whose Redis call fails.
  Each call gets `REDIS_TIMEOUT_MS` (1,000; at 200, ~1% of requests missed it,
  likely a fresh isolate's TLS handshake), and every "unreachable" log line carries the reason
  (`lastRedisFailure()`: timeout, `HTTP 401` wrong token, `HTTP 404`, network).
- Storage moved GCS → **Supabase Storage** (private `materials` bucket,
  `_shared/storage.ts`); the `GCS_*` names in older docs are stale.

The sections below describe the NestJS reference (`src/`). The Hono port mirrors
its structure one-for-one: `routers/<feature>.ts` ≈ controller,
`services/<feature>.service.ts` ≈ service, `_shared/` ≈ `infra/` + `common/`.

## Commands

```bash
npm run start:dev        # dev server with watch (http://localhost:8080)
npm run build            # compile TypeScript (must pass before pushing)
npm run lint             # eslint src/**/*.ts
npm run test             # jest (--passWithNoTests)
npm run db:bootstrap -- --local  # provision a fresh local DB from supabase/migrations/ (+ dev auth shim)
npm run prisma:generate  # regenerate Prisma clients (Node + Deno edge) after schema changes
npm run prisma:migrate   # deploy pending migrations (production)
npx prisma migrate dev --name <change>  # create and apply a migration in dev
```

First-time setup:
```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env          # set DATABASE_URL/DIRECT_URL (+ SUPABASE_URL for auth); AI/GCS/FCM optional
npm run db:bootstrap -- --local   # apply supabase/migrations/ to the fresh DB (dev auth shim included)
npm run start:dev
```
Note: `prisma/migrations/` is legacy (pre-Supabase) — the schema source of truth for
provisioning is `supabase/migrations/`; `prisma/schema.prisma` mirrors the final state.

Verify: `curl localhost:8080/v1/healthz` → `{"status":"ok"}`

Emit the OpenAPI spec to disk: `EMIT_OPENAPI=1 npm run start:dev`.

## Architecture

### Global wiring (`src/app.module.ts`)

Three global providers wrap every request:
- **`JwtAuthGuard`** (`common/guards/`) — verifies a Supabase Auth ES256 Bearer token against the project JWKS via `common/supabase-jwt.ts` (requires `SUPABASE_URL`). Sets `req.userId` (= `auth.users.id` = `profiles.id`), `req.isGuest` (`is_anonymous` claim), `req.sessionId`. Decorate a handler/class with `@Public()` to bypass.
- **`ContextInterceptor`** (`common/interceptors/`) — stores `{ userId, isGuest }` into `RequestContext` (AsyncLocalStorage) for the request lifetime.
- **`HttpExceptionFilter`** (`common/filters/`) — uniform error response shape.

Two global middlewares run before the guard:
- **`RateLimitMiddleware`** — Redis-backed rate limiting, stricter on `/auth/*`.
- **`IdempotencyMiddleware`** — deduplicates mutating requests via `Idempotency-Key` header.

### Tenancy pattern (critical)

`PrismaService` exposes a `.tenant` getter that auto-injects `user_id` into every query on tenant-scoped models (defined in `TENANT_MODELS`). **Always use `prisma.tenant.*` in feature services.** Use raw `prisma.*` only in `auth` and system paths.

`RequestContext` is an `AsyncLocalStorage`-backed singleton — services call `rc.userId` directly rather than receiving it as a parameter.

### Directory layout

```
src/
  main.ts            # bootstrap: /v1 prefix, CORS, ValidationPipe, Swagger
  app.module.ts      # all feature modules + global providers
  common/            # guards, interceptors, middleware, filters, RequestContext
  infra/             # shared singletons: Prisma, Redis, Token, Claude (Vertex/API),
                     #   Storage (GCS), Queue (BullMQ), Push (FCM), Revision
  features/          # one module per domain (see table below)
prisma/
  schema.prisma      # 21-table data model; migrations in prisma/migrations/
supabase/
  functions/         # Deno + Hono port (migration target — see banner above)
    api/             # main API function (Hono, basePath /api/v1)
    prisma-spike/    # phase-1 gate: Prisma driver adapter on edge
    _shared/         # context, http errors, vertex client, generated Deno Prisma client
```

### Feature modules

| Module | Spec section |
|---|---|
| *(auth removed)* | §2.1 — identity is Supabase Auth; no `/v1/auth/*` routes exist |
| `onboarding` | §2.1 — post-registration setup flow |
| `tasks` | §2.2 — CRUD + recurring engine (§4.2, `occursOn` logic) |
| `subjects`, `semesters` | §2.3 |
| `files` | §2.3 — presigned GCS upload/download |
| `focus` | §2.4 |
| `ada` | §2.5 — Claude-powered AI chat, breakdown, apply-plan |
| `streaks`, `mood` | §2.6, §2.7 |
| `profile`, `settings`, `tags` | §2.8 |
| `notifications`, `devices` | §2.9 — FCM push, per-tz reminder cron |
| `referrals`, `integrations`, `feedback` | §2.10, §2.12 |
| `prism` | §2.11 |
| `sync` | §4.6 — offline sync delta endpoint |
| `realtime` | §4.6 — Socket.IO revision stream |
| `health` | `/v1/healthz`, `/v1/readyz` |

### Infra services

- **`PrismaService`** — tenancy-aware Prisma client (see above).
- **`ClaudeService`** (`infra/claude.service.ts`) — calls Claude via Vertex AI or Anthropic SDK. Uses Opus 4.8 for Ada chat, Haiku 4.5 for fast tasks.
- **`StorageService`** — GCS presigned URLs.
- **`QueueService`** — BullMQ job dispatch (notifications, digests).
- **`RedisService`** — shared ioredis client.
- **`RevisionService`** — appends revision events for the realtime stream.
- **`PushService`** — FCM delivery.

### Wire contract

- All endpoints: `/v1/<resource>`, **snake_case** JSON (no camelCase conversion).
- DTO property names are written snake_case directly — NestJS does not transform case.
- `ValidationPipe` is `whitelist: true, forbidNonWhitelisted: true, transform: true`.
- Auth: `Authorization: Bearer <supabase_access_token>` (Supabase Auth; anonymous sign-in for guests). For local testing without Supabase, serve a mock JWKS and point `SUPABASE_URL` at it.
- Swagger UI at `/docs`; OpenAPI JSON at `/docs-json`.

### Ada's agent runtime (`supabase/functions/api/agent/`)

The most load-bearing subsystem here and the one with no NestJS equivalent —
`src/features/ada/` still holds the older single-shot `propose_plan` design.

| File | Role |
|---|---|
| `runtime.ts` | The act/observe loop. `runAgent` (MAX_TURNS 8) and `resumeRun` (MAX_RESUME_TURNS 5). Owns the system prompt and the `record_plan`/`finish` meta-tools. |
| `tools.ts` | The capability surface: 9 read tools (execute immediately) + 15 write tools (propose only). Each is a validated adapter over an existing feature service. |
| `pending.ts` | The confirmation gate — `ada_pending_actions` CRUD, `approveAction` (re-parses args against current state, then executes), `rejectAction`, `decideAll`. |
| `context.ts` | The grounded world-state block: today/local time/timezone/weekday, subject ids and study-tag names, open-task count, this chat's waiting proposals and the fate of earlier ones. |

Invariants to preserve when extending it:
- Write tools never execute inside the loop — they return
  `status: 'awaiting_user_confirmation'` and park a row.
- A tool's `parse()` throwing `ToolInputError` is a *correctable observation*, not
  a run failure; `runTool` converts every throw into `{error, hint}`.
- `pending.ts` must not import `runtime.ts` (the service layer calls both, keeping
  the dependency one-way).
- Conversation memory is `HISTORY_LIMIT` (16) raw `ada_messages` rows for the
  current session, replayed as plain text, plus the context block's digest of
  every earlier run's proposals and their fate, and the list of proposals still
  waiting in this chat.
- **The reply must match the proposals.** A turn that had a write rejected may
  not `finish` (the model sees the errors and retries), and `truthfulReply()`
  rewrites any reply that claims proposals the run did not make. Do not loosen
  either: on 26 Oct 2026 a run with zero proposals told a user "I have proposed
  5 tasks" four turns running.
- **Duplicates are merged in `createPendingAction`**: the same change already
  waiting is reused; the same title and day with new details replaces the old
  card (status `superseded`).
- **"Decline all"/"Approve all" gets one reply**, from the newest run, carrying
  the older runs' outcomes; everything declined gets a canned reply with no model
  call.

### Claude through Anthropic's API, inside $99 a month (`_shared/anthropic.ts`)

With `ANTHROPIC_API_KEY` set, Claude leads every tier and the GCP order below
becomes its fallback: **easy → Claude Haiku 5.5, middle → Claude Sonnet 5.5,
hard → Claude Opus 5.5**. Tuned for speed, not to a time budget: every tier
thinks at `low` effort, and Opus runs in **fast mode** (`speed: "fast"`, beta
`fast-mode-2026-02-01`, up to ~2.5× faster output at twice the price — $8/$40,
priced by the budget). A fast call that is rate-limited, rejected, or only
affordable at standard price is retried once at standard speed, never benched.
`AI_CALL_TIMEOUT_MS` (28 s) stays only as the cut-off for a hung call. The account's monthly API credit is spent up to
`ANTHROPIC_MONTHLY_BUDGET_USD` (99); past it, Claude is benched and Gemini on
Vertex answers until the period resets.

- **The cap lives in Postgres** (`ai_spend`, `ai_spend_reserve` /
  `ai_spend_settle`, migration `20261107130000_ai_spend.sql`), never Redis —
  Redis fails open. Each call reserves its worst case (every `max_tokens` at the
  output price, the prompt at the cache-write price) and settles to the real
  cost from `usage`. An API error releases the reservation (not billed); a
  timeout or dropped connection keeps it (it may have been). No ledger → no
  Claude (fail closed). Do not loosen any of these.
- A **402** (credit used up) benches Claude until the next period; **429/529**
  for `retry-after`; **401/403** for an hour, logged as an error. One bench
  (`ai:cool:anthropic`) covers every Claude model: the budget is per account.
- **Per-student share**: `ANTHROPIC_USER_DAILY_USD` (5) per UTC day, so one
  heavy user cannot spend everyone's month; past it that student gets Gemini
  for the day, nobody else is affected.
- Requests reuse `claudeRequest` / `claudeResult` (Claude on Vertex's), plus a
  cache breakpoint on the system prompt (tools + system) and top-level
  automatic caching for the conversation, and on Sonnet/Opus the server-side
  refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`);
  Haiku 5.5 has none. Prices in `PRICES`; an unknown model is priced at the top
  rate so the cap still holds. Update `PRICES` when a tier's model changes.
- Spend so far: `select * from ai_spend order by period_start desc;`
- Every call logs `[anthropic] {model,tier,ms,usd,in,cache_read,out}`; the cap
  logs `ANTHROPIC_BUDGET_REACHED` once per bench.

| Secret | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Turns it on |
| `ANTHROPIC_DIRECT` | on | `off` sends everything to GCP without removing the key |
| `ANTHROPIC_MONTHLY_BUDGET_USD` | 99 | The cap per period |
| `ANTHROPIC_BUDGET_RESET_DAY` | 1 | Day of the month (UTC) the credit resets |
| `ANTHROPIC_USER_DAILY_USD` | 5 | Per student per UTC day; 0 = no per-student cap |
| `ANTHROPIC_{EASY,MIDDLE,HARD}_MODEL` | haiku-5-5 / sonnet-5-5 / opus-5-5 | |
| `ANTHROPIC_{EASY,MIDDLE,HARD}_EFFORT` | low / low / low | Speed first; raise HARD to `medium` if hard answers fall short |
| `ANTHROPIC_{EASY,MIDDLE,HARD}_FAST` | off / off / on | Fast mode; only Opus 5.5 / 5 / 4.8 have it |

### How Ada reads a file (`agent/files.ts`, `agent/file_blocks.ts`, `_shared/media.ts`)

- **The stored type is a hint, not the truth.** The iOS picker gives no MIME,
  so uploads arrived as `application/octet-stream` and Ada refused a CV PDF
  and a PNG. `resolveMime` decides from the bytes (%PDF, PNG/JPEG/GIF/WebP/HEIC
  signatures), then a specific label, then the extension; `list_files` infers
  from the name and still lists files whose type is unknown. Files uploaded
  with the wrong type read fine for that reason — no backfill needed.
- **With Claude running Ada, `read_file` makes no model call of its own.** It
  returns the file in the tool_result as a `document` (PDF ≤ 20 MB, ≤ 100
  pages) or `image` block (png/jpeg/gif/webp ≤ 5 MB), and the running model
  reads it. Over a limit is a `ToolInputError` with a hint the model relays.
  Before this, every read was a separate call on the free Gemini keys, and on
  10 Nov 2026 all five 503'd while Claude was up.
- Otherwise (no Claude, or HEIC/audio/video) it extracts with one separate
  call on the models that can read the file — Claude, then Gemini on Vertex,
  then the free keys (`candidatesFor`), never Groq/Cerebras — and caches it.
- A file in the transcript reaches every provider: Claude natively, Gemini as
  `inlineData` beside the function response, Groq/Cerebras as a marker
  (`withoutFileData`). The stored `ada_agent_runs.transcript` keeps markers,
  never the bytes.
- **The budget prices a file by what Claude bills** (`mediaAwarePromptSize`:
  3,000 tokens a PDF page, 100 pages if uncountable; 5,000 an image), not by
  its base64 length, which under-priced long text-only PDFs and over-priced scans.

### Jev picks the tier (`agent/jev_tier.ts`)

With a Jev key set (`OPENROUTER_API_KEY`), each chat message's tier — and so
its Claude model — is Jev's answer to one `choice` question (~0.2 s, 1.5 s
timeout), reading the message and Ada's previous reply. `chooseTier()`'s rules
decide when Jev is off (`ADA_JEV_TIER=off`), fails, or is below
`JEV_TIER_MIN_CONFIDENCE` (0.6), and always for a file attached or a failed
previous run. The run's scratchpad says which decided (`Tier: hard (jev 0.83;
rules said middle …)`). The shadow (below) keeps comparing Jev with the rules.

### Model tiers (`agent/tiers.ts`, `_shared/ai.ts`)

Each message gets a tier once, and one model for the whole run (`pin`):
`easy` (questions, small talk) → free keys first; `middle` (changes) → Gemini
Flash on Vertex, the old order; `hard` (planning, files, ≥6 items, the user
saying it didn't work, or the previous run failing) → a stronger model, then
middle as fallback. A run whose proposals were ALL rejected retries once on the
next tier up before answering. Every run logs one `[ada-run] {...}` line with
tier, model, calls, ms, proposed, rejected and escalated.

| Secret | Default | Meaning |
|---|---|---|
| `ADA_HARD_MODEL` | `gemini` | `gemini`, `claude`, or `split` (half the users each, stable per user — for comparing the two) |
| `VERTEX_GEMINI_PRO_MODEL` | `gemini-3.1-pro-preview` | hard-tier Gemini on Vertex (a preview; `global` only) |
| `VERTEX_CLAUDE_MODEL` | `claude-haiku-5-5` | hard-tier Claude on Vertex ($0.10/$0.50 per 1M; `claude-sonnet-5-5` $2/$10, `claude-opus-5-5` $4/$20). Plain id, no date suffix. Each base model needs its own Vertex quota (`anthropic-claude-haiku` …), which starts at zero; a 429 benches it and the run falls back. |
| `VERTEX_CLAUDE_EFFORT` | `medium` | how hard Claude thinks: `low`, `medium`, `high`, `xhigh`, `max` |
| `VERTEX_REGION` | `global` | region for Claude on Vertex (Gemini uses `VERTEX_GEMINI_REGION`) |
| `GEMINI_THINKING_LEVEL` | `low` | Gemini 3 thinking level (`low`, `medium`, `high`); `ADA_THINKING_BUDGET`, if set, overrides it |
| `ADA_HARD_DAILY_CAP` | `40` | hard-tier runs per user per UTC day before falling back to middle (Redis; fails open) |

**Thinking counts toward the output limit on every current model.** Ada asks
for ~2,400 tokens; on 27 Oct 2026 Gemini 3 at its default (high) thinking spent
2,303 of them thinking on a weekly plan and proposed 1 task of 10. So Gemini
calls get at least `GEMINI_MIN_OUTPUT_TOKENS` (8,192) and, on Gemini 3 models,
`thinkingLevel: low` — measured complete in ~11–17s on 3.1 Pro and usually
~10–13s on 3.8 Flash, where `medium` took 27–59s against the 28s per-call
ceiling. `-latest` aliases and older models get no level (they reject it).

Claude Haiku / Sonnet / Opus 5.5 always think, thinking counts toward
`max_tokens`, and forcing a tool is a 400 on Sonnet/Opus — so `vertexClaudeChat` reserves
`CLAUDE_MIN_MAX_TOKENS` (16,000), turns a forced tool into `auto` plus an
instruction, and throws on a refusal, a cut-off reply, an empty reply or a
skipped forced tool, which moves the pool to the next model. It drops thinking
blocks rather than replaying them: the runtime edits earlier turns, and a
replayed block after an edit is a 400 on newer accounts.

`chooseTier()` is plain rules on purpose: it is the seam a decision model (Jev
or another System One API) replaces later, same inputs and output.

### Jev in shadow (`agent/jev_shadow.ts`, `_shared/decide.ts`, docs/JEV.md)

With `OPENROUTER_API_KEY` set (and `ADA_JEV_SHADOW` not `off`), every chat run
asks Jev, in one call after the reply is sent (`EdgeRuntime.waitUntil`), for
the tier, the intent, and per card "did the student ask for this?", the tag and
the subject — and stores its answers beside what Ada did in `ada_jev_shadow`.
It changes nothing a student sees. Keep it that way until docs/JEV.md's
phase 2b is decided on the data: `runJevShadow` never throws, and its only
write is its own table. `scripts/jev/` holds the live report and an offline
replay of past runs; their exports hold students' messages and stay out of
the repo.

### Credentials (optional in dev)

| Feature | Env var |
|---|---|
| Ada / AI | `ANTHROPIC_API_KEY` or `GCP_PROJECT_ID` (Vertex) |
| File upload | `GCS_USER_BUCKET` + service account |
| Push | `FCM_SERVICE_ACCOUNT_PATH` / APNs keys |

## Sign in with Apple after the October 2026 team transfer

The app moved Apple developer teams (SXN54W6F6T → R6YW5K2YSP). Apple ids are
team-scoped, so every pre-transfer Apple user gets a new id (and Hide My Email
users a new relay address). `supabase/migrations/20261023120000_apple_team_transfer.sql`
snapshots the old identities into `public.apple_team_transfer` and adds
`apple_transfer_relink(old_sub, new_sub, new_email)`, which moves one account to
the id Apple's user-migration API issued for it (`apple_user_migration.py` in the
workspace root, run with the new team's Sign in with Apple key).
- Never truncate `apple_team_transfer`: it is the only record of the old ids and
  the way back if a move has to be undone.
- A `conflict` row means the new id already had its own account (someone signed
  in fresh before being moved). Merge those by hand; do not automate it.
- Tests run the real SQL in PGlite: `api/apple_team_transfer_sql_test.ts`.

## Calendar import & Reminder import (v2)

`POST /v1/integrations/import` and `POST /v1/integrations/import/check`
(`routers/integrations.ts` → `services/calendar-import.service.ts`, decisions in the pure
`services/import_plan.ts`, tested by `import_plan_test.ts`). Edge-only, so the spec lives in
`openapi.edge-overlay.json` (run `npm run openapi:sync` after changing it). Contract §17.

- An import is a plain one-off task with `source = 'calendar_import'` and
  `metadata.import_key = "<source>:<external_id>"`. It is deliberately NOT written to
  `calendar_events`: `agent/schedule.ts` `busyBlocks()` reads that table as busy time on top
  of tasks, so an import stored in both would be counted twice.
- Re-importing never duplicates and never overwrites: a key with a live task is skipped
  untouched; a key whose task was deleted (status `cancelled`) is created again only if sent.
- No migration: the lookup is a raw query on `tasks.metadata->>'import_key'`, scoped to the
  user and `source = 'calendar_import'`.
- **The live DB has a CHECK on `tasks.source`** (`tasks_source_check`: manual | ada |
  calendar_import | material_import) that is in neither `supabase/migrations/` nor
  `prisma/schema.prisma`. Any other value fails the insert; widen the check in a migration first.
- The older `/calendar/ics` and `/google/oauth/callback` endpoints are unchanged and unused by the app.

## Onboarding v2 (design v11)

`POST /v1/onboarding/complete` also takes `heard_from`, `heard_from_other` and
`study_hours` (`services/onboarding_v2.ts`, tested by `onboarding_v2_test.ts`;
contract §2.1). They land in five new `user_profiles` columns from
`20261104120000_onboarding_v2_source_and_study_hours.sql`.
- Written with a raw query **after** onboarding's transaction, best-effort: until
  the migration is applied the answers are dropped with a log line and onboarding
  still completes. Apply the migration before relying on the data.
- The columns are deliberately **not** in `prisma/schema.prisma`: Prisma selects
  every mapped column, so mapping them before the migration would break every
  profile read.
- App freeze itself is device-local; nothing about frozen apps reaches the backend.
