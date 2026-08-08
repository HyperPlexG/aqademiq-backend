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
import { databaseUrl } from './env.ts';

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
  'AdaAgentRun', 'AdaPendingAction',
]);

let base: PrismaClient | undefined;

/** Raw client (no tenancy). Lazily constructed; reused across invocations. */
export function prismaBase(): PrismaClient {
  if (!base) {
    base = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
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
