# Deploy the Edge Functions API to the India project

Target Supabase project: **`qwvuoooentacjslzpbqy`** (Aqademiq Backend India, ap-south-1).
Base URL after deploy: `https://qwvuoooentacjslzpbqy.supabase.co/functions/v1/api`
The Flutter client keeps its `/v1/<resource>` paths on top of that base.

The full NestJS backend has been ported to Deno/Hono edge code under
`supabase/functions/` (23 routers, 19 services, ~101 endpoints). It typechecks under
Deno and boots locally (healthz/readyz/auth-guard verified). The Prisma query-compiler
gate (`prisma-spike`) passes.

## 0. What already works with NO secrets
Supabase auto-injects these into every edge function, and the code uses them:
- `SUPABASE_URL` → Supabase-Auth JWKS verification (the auth guard).
- `SUPABASE_SERVICE_ROLE_KEY` → account deletion + Storage signed URLs.
- `SUPABASE_DB_URL` → Prisma DB access (fallback when `DATABASE_URL` is unset).

So core CRUD + auth + account deletion + file storage work immediately after deploy.
The items in step 2 are enhancements/optional features.

## 1. Install the CLI + deploy (needs YOUR Supabase access token)
The MCP can't upload the ~60-file Prisma function inline, so use the Supabase CLI
(it bundles from disk). Get a token at Supabase → Account → Access Tokens.

```bash
# install (pick one)
brew install supabase/tap/supabase        # macOS
# or: npx supabase@latest --version

export SUPABASE_ACCESS_TOKEN=<your-personal-access-token>
cd "aqademiq-backend"

# regenerate the Deno Prisma client if schema changed (engineType=client → no native engine)
npx prisma generate

# deploy. --no-verify-jwt: the FUNCTION owns auth (Supabase JWKS guard) and keeps
# /healthz + /readyz public. The client always sends a token, so this is safe.
supabase functions deploy api --project-ref qwvuoooentacjslzpbqy --no-verify-jwt
supabase functions deploy prisma-spike --project-ref qwvuoooentacjslzpbqy
```

## 2. Optional secrets (set only the features you want live)
Reserved `SUPABASE_*` names are auto-injected — do NOT set them. Set others via:
`supabase secrets set NAME=value --project-ref qwvuoooentacjslzpbqy`

| Secret | Enables | Without it |
|---|---|---|
| `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true&connection_limit=1`) | Pooled prod DB | Falls back to auto `SUPABASE_DB_URL` (session pooler) — fine to launch |
| `ANTHROPIC_API_KEY` **or** Vertex set (`GCP_PROJECT_ID`,`GCP_SA_EMAIL`,`GCP_SA_PRIVATE_KEY`,`VERTEX_REGION`,`CLAUDE_OPUS_MODEL`,`CLAUDE_HAIKU_MODEL`) | Ada AI + task breakdown | Ada uses deterministic fallbacks (regex breakdown / placeholder reply). NOTE: Gemini/`GOOGLE_AI_API_KEY` is NOT supported on edge — use Anthropic or Vertex. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate limiting, idempotency, streak cache, revision fan-out | All fail-open (no rate limit; revision cursor = 0) |
| `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` | Feedback-board notification emails (Resend) | Emails skipped (auth OTP emails go via Supabase SMTP, not this) |
| `FCM_PROJECT_ID` + `FCM_CLIENT_EMAIL` + `FCM_PRIVATE_KEY` | Push (`POST /me/notifications/test`) | Push returns `skipped_no_provider` |
| `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`) | Google Calendar token encryption (integrations) | Calendar OAuth import fails; ICS import still works |
| `FEEDBACK_ADMIN_IDS` (comma-sep auth user ids) | Feedback-board `/admin/*` routes | Admin routes 403 for everyone |
| `TRUST_PROXY=1` | Correct client IP for rate limits | Rate limit keys off a coarser value |
| `SUPABASE_USER_BUCKET` | Override storage bucket (default `user-assets`) | Uses `user-assets` (already exists) |

## 3. Dashboard-only (Supabase MCP can't do these) — the `.modules.txt`/guide §3 items
- **Auth → Sign In/Providers → Anonymous sign-ins = ON** (guest "Jump in" flow). Currently
  DISABLED on India — the guest flow 422s until you enable it.
- **Email provider = ON, Confirm email = ON**; to keep the app's 6-digit OTP screens, edit
  the confirm-signup template to include `{{ .Token }}`.
- **Google / Apple providers** for social sign-in (client IDs per platform).
- **Custom SMTP** (Resend: smtp.resend.com:465, user `resend`, pass = Resend API key,
  sender `no-reply@aqademiq.app` with the domain verified) so auth emails aren't rate-limited.
- JWKS is already asymmetric ES256 (verified non-empty) — no migration needed.
- `on_auth_user_created` profiles trigger already present on India — verified.

## 4. Smoke test (after deploy + enabling anonymous sign-in)
```bash
export API=https://qwvuoooentacjslzpbqy.supabase.co/functions/v1/api
export SB=https://qwvuoooentacjslzpbqy.supabase.co
export ANON=<India anon key>   # Supabase → Project Settings → API

curl -s $API/v1/healthz     # {"status":"ok"}
curl -s $API/v1/readyz      # {"status":"ready","db":"ok"}
curl -s $API/functions/v1/prisma-spike -H "Authorization: Bearer $ANON"  # phase_a + phase_b ok

# guest session (requires Anonymous sign-in = ON)
TOKEN=$(curl -s -X POST "$SB/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{}' | jq -r .access_token)
AUTH="Authorization: Bearer $TOKEN"
curl -s $API/v1/profile -H "$AUTH"                 # profile (trigger created the row)
curl -s -X POST $API/v1/subjects -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Physics","color_hex":"#4A90D9"}'
curl -s -X POST $API/v1/tasks -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Smoke task","scheduled_at":"2026-08-01T10:00:00Z"}'
curl -s "$API/v1/tasks?from=2026-08-01&to=2026-08-02" -H "$AUTH"
curl -s $API/v1/feedback/meta -H "$AUTH"           # 5 statuses + 8 categories (live seeds)
curl -s -X DELETE $API/v1/profile/account -H "$AUTH" # {"status":"deleted"} — proves service-role
```

## Known port deviations (faithful, but noted)
- `POST /me/notifications/sweep` is degraded (returns `{enqueued:0}`) — the BullMQ reminder
  worker isn't ported; reschedule via a pg_cron/job_queue worker later if needed.
- Realtime revision fan-out is best-effort over Upstash PUBLISH; the Socket.IO gateway is
  replaced by Supabase Realtime Broadcast (client side).
- `validate.ts` treats JSON `null` as "field absent" on PATCH (won't null-out a column);
  matches normal use, differs only on explicit-null payloads.
- Gemini AI provider not ported to edge (Anthropic/Vertex only).
