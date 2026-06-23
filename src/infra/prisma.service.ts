import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../common/request-context';

const TENANT_MODELS = new Set([
  'User','UserProfile','Semester','Subject','SubjectFile','TaskSeries',
  'MoodEntry','StudyTag','ActivityEvent','FocusSession','AdaConversation','Device',
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
