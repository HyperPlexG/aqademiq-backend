import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../common/request-context';

// Models that carry a `user_id` column and are auto-scoped to the request user.
// Derived from the deployed Supabase schema (22 tables with a user_id column).
// `Profile` is scoped by its `id` (= auth.users.id), not user_id, so it is NOT here.
const TENANT_MODELS = new Set([
  'UserProfile', 'UserAppSettings', 'NotificationPreferences',
  'StudyTag', 'CalendarConnection', 'DeviceProfile',
  'AcademicTerm', 'Course', 'SubjectMaterial', 'TaskTag', 'Task',
  'PrismAudioProfile', 'FocusSession', 'MoodCheckin', 'AnalyticsSnapshot',
  'DailyActivitySnapshot', 'AdaSession', 'CalendarEvent', 'ReferralCode',
  'ShareEvent', 'AppRating', 'AppFeedback',
  'AdaAgentRun', 'AdaPendingAction'
]);

/** §3: application-level row scoping — every tenant query filtered by auth user.
 *  Use `prisma.tenant.*` in services; raw `prisma.*` only in auth/system paths. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private rc: RequestContext) { super(); }
  async onModuleInit() { await this.$connect(); }

  get tenant() {
    const rc = this.rc;
    return this.$extends({
      query: { $allModels: { async $allOperations({ model, operation, args, query }: { model?: string; operation: string; args: any; query: (a: any) => any }) {
        if (model && TENANT_MODELS.has(model)) {
          const a = args as any;
          if (operation.startsWith('find') || operation.startsWith('update') ||
              operation.startsWith('delete') || operation === 'count' || operation === 'aggregate') {
            a.where = { ...(a.where ?? {}), user_id: rc.userId };
          }
          if (operation === 'create') a.data = { ...(a.data ?? {}), user_id: rc.userId };
        }
        return query(args);
      }}},
    });
  }
}
