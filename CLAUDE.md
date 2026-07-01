# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev        # dev server with watch (http://localhost:8080)
npm run build            # compile TypeScript (must pass before pushing)
npm run lint             # eslint src/**/*.ts
npm run test             # jest (--passWithNoTests)
npm run keys:gen         # generate RS256 keypair into keys/ (once per dev setup)
npm run prisma:generate  # regenerate Prisma client after schema changes
npm run prisma:migrate   # deploy pending migrations (production)
npx prisma migrate dev --name <change>  # create and apply a migration in dev
```

First-time setup:
```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env          # fill DATABASE_URL, REDIS_*; AI/GCS/FCM are optional
npm run keys:gen
npx prisma migrate dev
npm run start:dev
```

Verify: `curl localhost:8080/v1/healthz` → `{"status":"ok"}`

Emit the OpenAPI spec to disk: `EMIT_OPENAPI=1 npm run start:dev`.

## Architecture

### Global wiring (`src/app.module.ts`)

Three global providers wrap every request:
- **`JwtAuthGuard`** (`common/guards/`) — verifies RS256 Bearer token via `TokenService`; checks Redis deny-list for revocation. Sets `req.userId`, `req.isGuest`, `req.sessionId`. Decorate a handler/class with `@Public()` to bypass.
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
```

### Feature modules

| Module | Spec section |
|---|---|
| `auth` | §2.1 — login, register, guest, refresh, revoke |
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
- **`TokenService`** — issues/verifies RS256 JWTs (jose); manages Redis deny-list.
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
- Auth: `Authorization: Bearer <access_token>`. Get a dev token via `POST /v1/auth/guest`.
- Swagger UI at `/docs`; OpenAPI JSON at `/docs-json`.

### Implementation state

The scaffold compiles end-to-end with ~219 `TODO(§x)` markers. Service method bodies are stubs. Suggested fill order: `auth` → `tasks` (§4.2 recurring engine first) → `subjects`/`semesters` → `mood`/`streaks` → `sync` → `ada`.

### Credentials (optional in dev)

| Feature | Env var |
|---|---|
| Ada / AI | `ANTHROPIC_API_KEY` or `GCP_PROJECT_ID` (Vertex) |
| File upload | `GCS_USER_BUCKET` + service account |
| Push | `FCM_SERVICE_ACCOUNT_PATH` / APNs keys |
