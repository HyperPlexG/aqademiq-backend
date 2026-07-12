# Aqademiq Backend — NestJS on GCP (scaffold)

Built from **BACKEND_REQUIREMENTS.md**. Complete breadth scaffold: every feature in the spec has a module, controller, service, real endpoints, and spec-tied `TODO(§x)` markers. **The whole thing compiles** (`npm run build`); business logic bodies are stubs to be filled in.

- **22 feature modules**, **95 endpoints**, **219** spec-referenced TODO markers.
- **Contract:** REST, **snake_case**, **/v1** prefix (`main.ts`). DTO shapes follow `task_dto.dart`/`subject_dto.dart` — contract-test against them.
- **AI:** Claude via **Vertex AI** (`infra/claude.service.ts`) — Opus 4.8 + Haiku 4.5.

## How the spec maps to the code

| Spec | Lives in |
|---|---|
| §2.1 Auth & onboarding | `features/auth`, `features/onboarding` |
| §2.2 Tasks + recurring engine (§4.2) | `features/tasks` — **the highest-risk engine; implement `occursOn` exactly** |
| §2.3 Subjects/semesters/files | `features/subjects`, `features/semesters`, `features/files` |
| §2.4 Focus / §2.11 Prism | `features/focus`, `features/prism` |
| §2.5 Ada / §4.3 AI | `features/ada`, `infra/claude.service.ts` |
| §2.6 Streaks / §2.7 Mood | `features/streaks`, `features/mood` |
| §2.8 Profile/settings/tags | `features/profile`, `features/settings`, `features/tags` |
| §2.9 Notifications / §4.5 push | `features/notifications`, `features/devices`, `infra/queue.service.ts` |
| §2.10 Referrals / §2.12 integrations | `features/referrals`, `features/integrations`, `features/feedback` |
| §4.6 Offline sync + revision stream | `features/sync`, `features/realtime` |
| §3 Data model (21 tables, user-scoped) | `prisma/schema.prisma` |
| §4.1 Tenancy + JWT | `common/` (guard, context, interceptor) + `infra/prisma.service.ts` |
| §4.4 GCS storage | `infra/storage.service.ts` |
| §6 Infra (Cloud SQL/Redis/Run/buckets) | `terraform/main.tf` |

## Run it

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL, REDIS_*, GCP_*, Claude, etc.
npx prisma migrate dev          # create the schema in your Postgres
npm run start:dev               # boots on :8080, all /v1 routes mounted
curl localhost:8080/v1/healthz  # {"status":"ok"}
```

## Build order (from §6)

1. **Phase 1 (P0):** auth, tenancy, **recurring-task engine (§4.2)**, Task/Subject/Semester/Mood CRUD, sync + revision stream, presigned upload, devices+scheduler+4 reminders, Ada chat + apply-plan gate, breakdown.
2. **Phase 2 (P1):** week-planner, conversation history, OCR, Prism CDN, focus persistence, streaks recompute, digests, observability, compliance.
3. **Phase 3 (P2):** syllabus→tasks, referral rewards, calendar import, in-app inbox, avatar photo upload.

## Where to start
Fill services in this order: `auth` → `tasks` (the §4.2 engine first — everything calendar depends on it) → `subjects`/`semesters` → `mood`/`streaks` → `sync` → `ada`. Each `TODO(§x)` points back to the exact spec section.

> Generated as a breadth-first scaffold. Deep implementation is deliberately deferred to `TODO` markers so the full surface is navigable and compiles end-to-end.
