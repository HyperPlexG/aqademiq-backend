// Tenancy-aware Prisma client for Edge Functions — port of src/infra/prisma.service.ts.
//
// Uses the Rust-free query compiler (engineType="client") + the pg driver adapter
// against the Supavisor transaction pooler. Proven under Deno by prisma-spike.
//
// - `prisma` — raw client (use only in system paths: profile-by-id, deletion, seeds).
// - `tenantDb()` — auto-injects `user_id` from RequestContext on tenant-scoped
//   models, exactly like NestJS `PrismaService.tenant`. Use in feature services.

import './node-shims.ts'; // MUST precede the Prisma client import (polyfills process.pid, etc.)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './prisma/client.ts';
import { RequestContext } from './context.ts';
import { databaseUrl, env } from './env.ts';

// Models that carry a `user_id` column and are auto-scoped to the request user.
// Mirrors TENANT_MODELS in src/infra/prisma.service.ts. `Profile` is scoped by
// its `id` (= auth.users.id), not user_id, so it is NOT here.
const TENANT_MODELS = new Set([
  'UserProfile', 'UserAppSettings', 'NotificationPreferences',
  'StudyTag', 'CalendarConnection', 'DeviceProfile',
  'AcademicTerm', 'Course', 'SubjectMaterial', 'TaskTag', 'Task',
  'PrismAudioProfile', 'FocusSession', 'MoodCheckin', 'AnalyticsSnapshot',
  'DailyActivitySnapshot', 'AdaSession', 'CalendarEvent', 'ReferralCode',
  'ShareEvent', 'AppRating', 'AppFeedback',
  'AdaAgentRun', 'AdaPendingAction', 'AdaMemory',
]);

let base: PrismaClient | undefined;

/**
 * Per-isolate connection ceiling.
 *
 * Postgres here allows 60 connections in total, and roughly a dozen are already
 * spoken for by pg_cron, PostgREST, pg_net and the metrics exporter — so about
 * 48 are actually available. node-postgres defaults to a pool of 10 per Pool
 * instance, and each warm Edge isolate holds its own. That means ~5 concurrent
 * isolates can exhaust the server, at which point every other isolate starts
 * failing to connect: an outage produced by traffic, not by any single slow
 * query.
 *
 * 2 is deliberately small. Requests reach Postgres through the Supavisor
 * transaction pooler, which already multiplexes many client connections onto few
 * server ones, so a big per-isolate pool buys nothing and only reserves scarce
 * slots. Two lets a handler overlap a pair of queries without ever becoming the
 * isolate that starves the others.
 */
const POOL_MAX = (() => {
  const raw = env('DB_POOL_MAX');
  if (raw === undefined || raw.trim() === '') return 2;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 2;
})();

/** Raw client (no tenancy). Lazily constructed; reused across invocations. */
export function prismaBase(): PrismaClient {
  if (!base) {
    base = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl(),
        max: POOL_MAX,
        // An isolate can stay warm long after its last request. Without this it
        // keeps holding connections it is not using, against a 60-slot budget.
        idleTimeoutMillis: 10_000,
        // Fail fast instead of queueing behind an exhausted pool: a request that
        // cannot get a connection in 5s should surface an error the client can
        // retry, not hang until the platform kills the whole invocation.
        connectionTimeoutMillis: 5_000,
      }),
    });
  }
  return base;
}

// The tenancy extension reads RequestContext.userId at query time, so a single
// cached extended client is correct across requests (ALS supplies per-request id).
let tenantClient: ReturnType<typeof buildTenant> | undefined;

function buildTenant() {
  return prismaBase().$extends({
    query: {
      $allModels: {
        // deno-lint-ignore no-explicit-any
        async $allOperations({ model, operation, args, query }: { model?: string; operation: string; args: any; query: (a: any) => any }) {
          if (model && TENANT_MODELS.has(model)) {
            const a = args as Record<string, unknown>;
            if (operation.startsWith('find') || operation.startsWith('update') ||
                operation.startsWith('delete') || operation === 'count' || operation === 'aggregate') {
              a.where = { ...(a.where as Record<string, unknown> ?? {}), user_id: RequestContext.userId };
            }
            if (operation === 'create') {
              a.data = { ...(a.data as Record<string, unknown> ?? {}), user_id: RequestContext.userId };
            }
          }
          return query(args);
        },
      },
    },
  });
}

/** Tenancy-scoped client — every query filtered/stamped by the request user. */
export function tenantDb() {
  if (!tenantClient) tenantClient = buildTenant();
  return tenantClient;
}

export type { PrismaClient };
