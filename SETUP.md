# Aqademiq Backend — Developer Setup

NestJS (TypeScript) · PostgreSQL (Prisma) · Redis · `/v1` REST, snake_case · custom RS256 JWT auth.

## Prerequisites
- **Node 20+** and npm
- **Docker** (for local Postgres + Redis) — or your own Postgres/Redis
- **OpenSSL** (preinstalled on macOS/Linux) — for the JWT keypair

## First-time setup (clone → running in ~5 min)
```bash
git clone <repo-url> && cd aqademiq-gcp

npm install

# 1. Start Postgres + Redis
docker compose up -d

# 2. Environment — copy the template and fill what you need
cp .env.example .env
#    Local defaults already work. Optional: ANTHROPIC_API_KEY or GCP_PROJECT_ID
#    to enable Ada/AI; GCS_* for file upload; FCM_* for push. All optional in dev.

# 3. Create the database schema + seed data (supabase/migrations/, with local auth shim)
npm run db:bootstrap -- --local

# 4. Run it (watch mode, http://localhost:8080)
npm run start:dev
```

Verify:
```bash
curl localhost:8080/v1/healthz     # {"status":"ok"}
curl localhost:8080/v1/readyz      # {"status":"ready","db":"ok","redis":"ok"}
```

## API reference & testing
- **Swagger UI:** http://localhost:8080/docs  (click *Authorize*, paste a Bearer token)
- **OpenAPI spec:** http://localhost:8080/docs-json — import into Postman to get the whole collection.
- **Auth:** Supabase Auth access tokens (`Authorization: Bearer <token>`) — the guard verifies them against `SUPABASE_URL`'s JWKS. There are no `/v1/auth/*` routes; guests use Supabase anonymous sign-in. For purely local testing, run a mock JWKS server and point `SUPABASE_URL` at it.

## Project layout
- `src/features/*` — one module per domain (auth, tasks, subjects, mood, …)
- `src/infra/*` — Prisma, Redis, Claude (Vertex/Anthropic), Storage (GCS), Queue (BullMQ), Token, Push
- `src/common/*` — JWT guard, tenancy context, idempotency + rate-limit middleware, exception filter
- `prisma/schema.prisma` — data model (migrations checked in under `prisma/migrations/`)
- `supabase/functions/*` — Deno + Hono port (migration target; `_shared/prisma/` is generated, not committed)

## Conventions
- Every feature service is user-scoped via `prisma.tenant.*` (auto-injects `user_id`); raw `prisma.*` only in auth/system paths.
- Wire contract is **snake_case** and **`/v1`**-prefixed — matches the Flutter DTOs.
- Run `npm run build` before pushing (0 TS errors). Conventional migrations: `npx prisma migrate dev --name <change>`.

## What needs credentials (works without them in dev; degrades gracefully)
| Feature | Env | Without it |
|---|---|---|
| Ada AI / breakdown | `ANTHROPIC_API_KEY` **or** `GCP_PROJECT_ID` (+ Vertex quota) | placeholder reply / regex steps |
| File upload/download | `GCS_USER_BUCKET` (+ service account) | `501` |
| Push delivery | `FCM_SERVICE_ACCOUNT_PATH` / APNs keys | logged, not sent |

## Deploy
**Target platform: Supabase Edge Functions** — see `docs/DEPLOYMENT_RUNBOOK.md` Phase 1
(`supabase functions deploy`, secrets via `supabase secrets set`). The Deno + Hono port
lives in `supabase/functions/`.

Legacy (until cutover): GitHub Actions (`.github/workflows/deploy.yml`): CI (build + `prisma validate`) on every push/PR; deploy to Cloud Run on `main` via Workload Identity Federation. Set repo vars `GCP_PROJECT_ID`, `GCP_REGION` and secrets `WIF_PROVIDER`, `DEPLOY_SA`, `DATABASE_URL`. (CD needs a provisioned Cloud SQL/Memorystore + paid GCP.)

> **Never commit `.env`** — it is gitignored. (`keys/` + `npm run keys:gen` are legacy from the custom-JWT era; auth is Supabase Auth now.)
