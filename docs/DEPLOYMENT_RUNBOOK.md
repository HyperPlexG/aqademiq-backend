# Aqademiq — Deployment Runbook (App Store + Play Store)

Goal: get the backend live and the Flutter app submitted to both stores.
Order matters: **backend must be deployed and reachable over HTTPS before the app is
built for release**, because the app bakes its API URL in at build time.

Status legend: ✅ done in-repo · 🔧 config you run · 🔒 human-only (accounts/keys, cannot be scripted here).

---

## Phase 1 — Backend to Supabase Edge Functions (target platform)

> **Migration status (2026-07-16):** the backend is being ported from NestJS/Cloud Run
> to **Deno + Hono on Supabase Edge Functions** — code under `supabase/functions/`.
> Gate: the `prisma-spike` function (Prisma driver adapter inside an Edge Function)
> must pass before feature porting continues. Until cutover, the legacy GCP path
> (Phase 1L below) remains the fully-implemented production path.
> Vertex AI is **kept** for Claude inference via `supabase/functions/_shared/vertex.ts`.

### 1.1 Provision 🔧
- Create a Supabase project (EU region, matching the current `europe-west1` pinning).
- Record: pooled `DATABASE_URL` (Supavisor, port 6543), `DIRECT_URL` (port 5432, for
  migrations), project ref, anon + service-role keys.
- Storage buckets: `user-assets` (private) and `prism-cdn` (public).
- Upstash Redis (rate limiting, idempotency, JWT deny-list, signin lockout).

### 1.2 Secrets (`supabase secrets set NAME=value`) 🔒
| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Auth: the API verifies Supabase Auth ES256 tokens against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (custom RS256 JWT was removed 2026-07-18) |
| `DATA_ENCRYPTION_KEY` | as in the legacy table below |
| `GCP_PROJECT_ID` / `GCP_SA_EMAIL` / `GCP_SA_PRIVATE_KEY` / `VERTEX_REGION` | Vertex AI (service account needs `roles/aiplatform.user`) |
| `CLAUDE_OPUS_MODEL` / `CLAUDE_HAIKU_MODEL` | Vertex model ids incl. `@version` suffix |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis-backed middleware |
| `GOOGLE_OAUTH_*` / `APPLE_OAUTH_CLIENT_IDS` / `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM` / FCM | same roles as the legacy table |

### 1.3 Migrate + deploy 🔧
```bash
npx prisma migrate deploy      # against DIRECT_URL
npx prisma generate            # also emits the Deno client into supabase/functions/_shared/prisma
supabase functions deploy api prisma-spike   # or deploy via the Supabase MCP
```

### 1.4 Smoke test 🔧
```bash
curl https://<ref>.supabase.co/functions/v1/prisma-spike -H "Authorization: Bearer <anon-key>"
# → phase_a_raw_sql.ok:true AND phase_b_prisma.ok:true, else stop and fix
curl https://<ref>.supabase.co/functions/v1/api/v1/healthz   # {"status":"ok"}
```

---

## Phase 1L — Backend to Cloud Run (legacy — production path until cutover)

### 1.1 Provision infra 🔒🔧
The repo ships Terraform (`terraform/main.tf`) and a GitHub Actions deploy
(`.github/workflows/deploy.yml`, Cloud Run via Workload Identity Federation).
You need a **paid GCP project** with billing enabled, then:
- Cloud SQL for PostgreSQL (Enterprise Plus / HA), Memorystore for Redis, two GCS
  buckets (private user bucket + public Prism CDN), Artifact Registry.
- Region: pin to your users (`.env` defaults to `europe-west1`).

### 1.2 Secrets (Secret Manager) 🔒
Set every production secret — do **not** ship `.env` to prod:

| Secret | Purpose | Required? |
|---|---|---|
| `DATABASE_URL` | Cloud SQL connection (via connector/proxy) | **Yes** |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_AUTH_STRING` | Memorystore | **Yes** |
| `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` | RS256 keypair mounted from Secret Manager | **Yes** |
| `NODE_ENV=production` | **Disables `dev_code` OTP leakage + error internals** | **Yes — critical** |
| `TRUST_PROXY=1` | Trust Cloud Run's `X-Forwarded-For` for client IP (rate limits) | **Yes on Cloud Run** |
| `DATA_ENCRYPTION_KEY` | 32-byte base64/hex — encrypts calendar OAuth tokens at rest (`openssl rand -base64 32`) | If using Google Calendar import |
| `GCS_USER_BUCKET` / `GCS_PRISM_CDN_BUCKET` | File upload + Prism CDN | For files / Prism audio |
| `ANTHROPIC_API_KEY` **or** `GCP_PROJECT_ID` (+Vertex) | Ada AI | For Ada |
| `GOOGLE_OAUTH_CLIENT_IDS` / `APPLE_OAUTH_CLIENT_IDS` | SSO id-token audiences | For social sign-in |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google Calendar import code exchange | For calendar import |
| `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM` | Resend — real OTP email delivery | **Yes for production** (otherwise codes only hit the console) |
| `FCM_SERVICE_ACCOUNT_PATH` / `APNS_*` | Push notifications | For reminders |

> ⚠️ The working-tree `.env` currently contains a live-looking `GOOGLE_AI_API_KEY`.
> **Rotate it** and load all secrets from Secret Manager, not a file, in prod.

### 1.3 Migrate + deploy 🔧
```bash
# from aqademiq/
npm ci
npm run build
npx prisma migrate deploy      # apply migrations to Cloud SQL
# then deploy the container (GitHub Actions on push to main, or gcloud run deploy)
```
Container: the repo `Dockerfile` builds the Nest app. Ensure the RS256 keys are
mounted and `NODE_ENV=production`.

### 1.4 Smoke-test the live backend 🔧
```bash
curl https://<your-api-base-url>/v1/healthz     # {"status":"ok"}
curl https://<your-api-base-url>/v1/readyz      # db+redis ok
```
Confirm `/docs` and `/docs-json` (Swagger) are **not** publicly reachable in prod,
and `ENABLE_SQL_SMOKE_TEST` is unset. See `docs/PENTEST_TESTING_GUIDE.md` §4 before launch.

---

## Phase 2 — Flutter app configuration

### 2.1 App identity ✅ (already set)
- Bundle/app id: `com.aqademiq.aqademiq` (Android `applicationId` + iOS `PRODUCT_BUNDLE_IDENTIFIER`).
- Display name: **Aqademiq** (iOS `CFBundleDisplayName`; Android `android:label` is `aqademiq` — capitalize it in `AndroidManifest.xml` if you want "Aqademiq" under the icon).
- Version: `1.0.0+1` in `pubspec.yaml` (`versionName+versionCode`). Bump the `+build` on every store upload.

### 2.2 Wire the live backend ⚠️ (see FRONTEND_INTEGRATION_PLAN.md)
The app currently ships in **mock mode** (`Env.useMocks=true`) and the feature data
sources are not yet mapped to the backend response shapes. The networking
**foundation is in place** (secure token storage, Bearer + refresh interceptor —
`lib/data/auth/token_store.dart`, `lib/core/network/auth_interceptor.dart`), but the
per-domain source wiring is a specified task in **FRONTEND_INTEGRATION_PLAN.md** that
must be done + tested against the live backend from a machine with the Flutter SDK.
Do not submit to stores until that is complete and exercised end-to-end.

### 2.3 Build for release with the live URL 🔧
On the Supabase target, `API_BASE_URL` is `https://<ref>.supabase.co/functions/v1/api`
(the app keeps its `/v1/<resource>` paths on top of it). `SOCKET_URL` is legacy-only —
the Supabase port replaces Socket.IO with Supabase Realtime Broadcast.
```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # regenerate freezed/json

# Android App Bundle
flutter build appbundle --release \
  --dart-define=USE_MOCKS=false \
  --dart-define=API_BASE_URL=https://<your-api-base-url> \
  --dart-define=SOCKET_URL=https://<your-api-base-url>

# iOS
flutter build ipa --release \
  --dart-define=USE_MOCKS=false \
  --dart-define=API_BASE_URL=https://<your-api-base-url> \
  --dart-define=SOCKET_URL=https://<your-api-base-url>
```

### 2.4 App icons 🔧
Add `flutter_launcher_icons` (dev dep), drop a 1024×1024 master into `assets/`, and
generate per-platform icons. The default Flutter icon will get a submission rejected.

### 2.5 Permissions 🔧
The app declares no risky runtime permissions today. If you add features later:
- **File/photo upload** (image_picker) → iOS `NSPhotoLibraryUsageDescription`, and it's handled by the picker on Android 13+.
- **Push notifications** → iOS Push capability + `aps-environment`; Android POST_NOTIFICATIONS (Android 13+).
- Add each with a clear purpose string, or App Review will reject.

---

## Phase 3 — Android (Google Play)

### 3.1 Upload keystore 🔒
```bash
keytool -genkey -v -keystore ~/aqademiq-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```
Create `android/key.properties` (already gitignored):
```
storePassword=<pw>
keyPassword=<pw>
keyAlias=upload
storeFile=/absolute/path/to/aqademiq-upload.jks
```
The Gradle release build (`android/app/build.gradle.kts`, already wired ✅) picks this
up automatically; without it, release falls back to debug signing.
> Optional: enable `isMinifyEnabled`/`isShrinkResources` (commented in the gradle file)
> after verifying nothing reflective is stripped.

### 3.2 Play Console 🔒
- Create the app, complete **Data safety** (declare: account/email, user content,
  device identifiers if push; encryption in transit; deletion via in-app
  `DELETE /auth/account`), **Content rating**, target audience, privacy-policy URL.
- Upload the `.aab`, roll out to internal testing first, then production.

---

## Phase 4 — iOS (App Store)

### 4.1 Signing 🔒
- Apple Developer Program membership.
- App ID `com.aqademiq.aqademiq` + provisioning; distribution certificate.
- Set the team in Xcode (`ios/Runner.xcodeproj`) or via `flutter build ipa --export-options-plist`.

### 4.2 App Store Connect 🔒
- Create the app record, upload the `.ipa` (Transporter/Xcode).
- **App Privacy** nutrition labels (email, user content, identifiers, usage data),
  privacy-policy URL, screenshots for required device sizes, age rating.
- Sign-in with Apple is already backend-supported; if you offer any social login,
  Apple requires Sign-in-with-Apple to be offered too.

---

## Pre-submission checklist (both stores)

- [ ] Backend live, `NODE_ENV=production`, `TRUST_PROXY=1`, Swagger/debug endpoints closed, `.env` AI key rotated.
- [ ] Real OTP email delivery configured (Resend) — users can actually receive codes.
- [ ] Frontend wired to live API and **exercised end-to-end** (FRONTEND_INTEGRATION_PLAN.md).
- [ ] `USE_MOCKS=false` + correct `API_BASE_URL`/`SOCKET_URL` baked into the release build.
- [ ] Real app icons; display name capitalized.
- [ ] Privacy policy URL published; data-safety / app-privacy declarations filled.
- [ ] Account deletion path works in-app (store policy requirement) — backed by `DELETE /auth/account`.
- [ ] Build number bumped; internal-testing track validated before production.
