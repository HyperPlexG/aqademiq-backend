# Backend contract — DROP YOUR NESTJS SPEC HERE

Placeholder for your **NestJS / Google Cloud backend contract**. Put whichever you
have here, then point Claude Code at it (README §8, Prompt C):

- `openapi.json` — **preferred.** Export from `@nestjs/swagger` (the `/api-json`
  route, or write `SwaggerModule` output to a file). Claude Code generates Dart
  `freezed` DTOs + a Dio client from this.
- `dtos/` — copy your Nest `*.dto.ts` + `*.controller.ts` if you have no Swagger output.
- `schema.sql` / migrations — Cloud SQL Postgres DDL (for RLS + pgvector context).
- `socket-events.md` — Socket.IO channels + event payloads (focus ticks, presence, notifications).

Also record (in `../INTEGRATION.md` §0):
- Identity Platform project / API key / OAuth client IDs (guest + Google/Apple)
- GCS signed-upload endpoint(s) + bucket (profile images, syllabi, audio)
- API base URL (Cloud Run) + Socket.IO URL (mind session affinity) — env only
- Eventarc/Pub/Sub domain events the app reacts to (`TASK_COMPLETED`, `FOCUS_SESSION_STARTED`, …)
- Ada endpoint (`/ada/messages`) shape + whether it streams (SSE / Socket.IO)

> Until a real spec lands here, the Flutter app builds against the **mock models** in
> `../INTEGRATION.md` §3 with `Env.useMocks=true`, so UI work (all 88 frames) isn't blocked.
