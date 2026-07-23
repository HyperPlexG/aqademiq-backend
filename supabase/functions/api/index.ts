// Supabase Edge Function: main API — Hono port of the NestJS backend.
//
// URL shape: https://<ref>.supabase.co/functions/v1/api/v1/<resource>
// The Flutter client keeps its `/v1/<resource>` wire contract unchanged; only
// its base URL moves, to  https://<ref>.supabase.co/functions/v1/api
//
// Global wiring mirrors src/app.module.ts:
//   rate-limit + idempotency middleware (Upstash, fail-open) → Supabase-JWKS
//   auth guard (runs the request under RequestContext) → feature routers →
//   uniform snake_case error filter.

import { Hono } from 'hono';
import { cors } from 'npm:hono@4/cors';
import { HttpError, errorBody } from '../_shared/http.ts';
import { supabaseAuth } from '../_shared/auth.ts';
import { rateLimit, idempotency } from '../_shared/redis.ts';
import { prismaBase } from '../_shared/prisma.ts';
import { notificationsService } from './services/notifications.service.ts';

// ---- feature routers ----
import { profileRouter, meRouter } from './routers/profile.ts';
import { streaksRouter, activityRouter } from './routers/streaks.ts';
import { moodRouter } from './routers/mood.ts';
import { tagsRouter } from './routers/tags.ts';
import { prismRouter } from './routers/prism.ts';
import { devicesRouter } from './routers/devices.ts';
import { notificationsRouter } from './routers/notifications.ts';
import { subjectsRouter } from './routers/subjects.ts';
import { semestersRouter } from './routers/semesters.ts';
import { adaRouter } from './routers/ada.ts';
import { onboardingRouter } from './routers/onboarding.ts';
import { referralsRouter } from './routers/referrals.ts';
import { integrationsRouter } from './routers/integrations.ts';
import { syncRouter } from './routers/sync.ts';
import { focusRouter } from './routers/focus.ts';
import { settingsRouter } from './routers/settings.ts';
import { feedbackRouter } from './routers/feedback.ts';
import { feedbackBoardRouter, feedbackBoardAdminRouter, changelogRouter } from './routers/feedback-board.ts';
import { tasksRouter } from './routers/tasks.ts';
import { filesRouter } from './routers/files.ts';

const app = new Hono().basePath('/api/v1');

// Public paths (relative to basePath) — mirror @Public() in the Nest app.
// `/cron/notifications` bypasses the Supabase-JWT guard (pg_cron has no user
// token) but is gated by a shared `x-cron-secret` header inside its handler.
const PUBLIC_PATHS = new Set(['/healthz', '/readyz', '/cron/notifications']);

// CORS first — browsers (Flutter web) send an unauthenticated OPTIONS preflight,
// which must be answered before the auth guard runs.
app.use('*', cors({
  origin: '*',
  allowHeaders: ['authorization', 'content-type', 'apikey', 'x-client-info', 'idempotency-key', 'x-requested-with'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

app.use('*', rateLimit());
app.use('*', idempotency());
app.use('*', supabaseAuth(PUBLIC_PATHS));

// ---- health ----
app.get('/healthz', (c) => c.json({ status: 'ok' }));
app.get('/readyz', async (c) => {
  let db = 'ok';
  try {
    await prismaBase().$queryRawUnsafe('select 1');
  } catch {
    db = 'error';
  }
  return c.json({ status: db === 'ok' ? 'ready' : 'degraded', db }, db === 'ok' ? 200 : 503);
});

// ---- internal: cron-triggered reminder sweep ----
// pg_cron POSTs here every minute with the shared secret. Runs system-wide (no
// user context) and fires due task reminders via FCM/APNs.
app.post('/cron/notifications', async (c) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || c.req.header('x-cron-secret') !== secret) {
    throw new HttpError(401, 'Unauthorized');
  }
  return c.json(await notificationsService.runReminderSweep());
});

// ---- feature routers (mounted under basePath /api/v1) ----
// More specific /me subpaths first so they aren't shadowed by the /me mounts.
app.route('/me/notifications', notificationsRouter);
app.route('/me', meRouter);
app.route('/me', settingsRouter);

app.route('/profile', profileRouter);
app.route('/streaks', streaksRouter);
app.route('/tasks', tasksRouter);
app.route('/subjects', subjectsRouter);
app.route('/semesters', semestersRouter);
app.route('/mood-entries', moodRouter);
app.route('/study-tags', tagsRouter);
app.route('/prism-modes', prismRouter);
app.route('/focus-sessions', focusRouter);
app.route('/ada', adaRouter);
app.route('/devices', devicesRouter);
app.route('/onboarding', onboardingRouter);
app.route('/referrals', referralsRouter);
app.route('/integrations', integrationsRouter);
app.route('/sync', syncRouter);

// Files: /uploads/* + /files/* (root-level paths under basePath).
app.route('/', filesRouter);

// Feedback: board (/feedback/*) before the root feedbackRouter (exact POST /feedback).
app.route('/feedback', feedbackBoardRouter);
app.route('/admin', feedbackBoardAdminRouter);
app.route('/changelog', changelogRouter);
app.route('/', feedbackRouter);

// Root-level activity endpoints (activity-dates, week-count, today-has-activity).
app.route('/', activityRouter);

// ---- uniform error shape — port of common/filters/http-exception.filter.ts ----
app.notFound((c) => c.json(errorBody(404, 'Not found', c.req.path), 404));

app.onError((err, c) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Internal server error';
  const errors = err instanceof HttpError ? err.errors : undefined;
  if (status >= 500) console.error(`${c.req.method} ${c.req.path} -> ${status}`, err);
  const body = errorBody(status, message, c.req.path, errors);
  // Opt-in error detail for debugging on the live stack (never on by default).
  if (status >= 500 && Deno.env.get('DEBUG_ERRORS') === '1') {
    // deno-lint-ignore no-explicit-any
    (body as any).detail = err instanceof Error ? err.message : String(err);
    // deno-lint-ignore no-explicit-any
    (body as any).stack = err instanceof Error ? err.stack : undefined;
  }
  // deno-lint-ignore no-explicit-any
  return c.json(body, status as any);
});

Deno.serve(app.fetch);
