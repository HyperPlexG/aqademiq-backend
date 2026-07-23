// §2.9 — notifications inbox/history + test push. Port of
// src/features/notifications/notifications.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { HttpError } from '../../_shared/http.ts';
import { push } from '../../_shared/push.ts';

interface DueReminderRow {
  task_id: string;
  user_id: string;
  title: string;
  push_token: string;
  device_type: string | null;
}

export const notificationsService = {
  /** GET /me/notifications/history */
  async history() {
    return { notifications: [] };
  },

  /** GET /me/notifications/inbox */
  async inbox() {
    return {
      notifications: [],
      unread_count: 0,
    };
  },

  /** POST /me/notifications/test */
  async test() {
    const device = await tenantDb().deviceProfile.findFirst({
      orderBy: { id: 'desc' },
    });
    if (!device) throw new HttpError(400, 'No registered device to send a test push to');

    // Always FCM — iOS registers an FCM token too (Firebase → APNs).
    const token = device.push_token ?? '';
    const result = await push.send(
      'fcm',
      token,
      'Aqademiq',
      'This is a test notification 🎓',
      { channel_key: 'test' },
    );

    return {
      id: crypto.randomUUID(),
      channel_key: 'test',
      status: result.status,
      read: false,
      created_at: new Date(),
      provider: 'fcm',
      error: result.error,
    };
  },

  /**
   * System-wide reminder sweep, triggered by pg_cron (POST /cron/notifications).
   * Runs OUTSIDE any user context (raw client, no tenancy), so it must scope every
   * query by user_id explicitly.
   *
   * v1 handles "before task" reminders: any task whose `reminder_at` has passed,
   * for a user who has push + before-task reminders enabled and a registered
   * device token. Each reminder is claimed in `notification_deliveries` before
   * sending (unique `dedup_key`), so it fires exactly once even if sweeps overlap.
   * Daily check-ins (morning/evening, per-timezone) are a follow-up.
   */
  async runReminderSweep(limit = 200) {
    const db = prismaBase();

    const rows = await db.$queryRawUnsafe<DueReminderRow[]>(`
      select t.id as task_id, t.user_id, t.title, d.push_token, d.device_type
      from tasks t
      join notification_preferences np on np.user_id = t.user_id
      join device_profiles d
        on d.user_id = t.user_id and d.push_token is not null and d.push_token <> ''
      left join notification_deliveries nd
        on nd.dedup_key = 'before_task:' || t.id::text
      where t.reminder_at is not null
        and t.reminder_at <= now()
        and t.reminder_at > now() - interval '2 days'  -- don't fire stale backlogs
        and t.completed_at is null
        and t.status <> 'completed'
        and np.push_enabled = true
        and np.before_task_enabled = true
        and nd.id is null
      order by t.reminder_at asc
      limit ${Number(limit)}
    `);

    let sent = 0;
    let failed = 0;
    for (const r of rows) {
      // Claim the delivery first (race-safe): only send if we win the insert.
      const claim = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `insert into notification_deliveries (user_id, kind, task_id, dedup_key, status)
         values ($1, 'before_task', $2, $3, 'pending')
         on conflict (dedup_key) do nothing
         returning id`,
        r.user_id,
        r.task_id,
        `before_task:${r.task_id}`,
      );
      if (claim.length === 0) continue; // another sweep already took it
      const deliveryId = claim[0].id;

      // Both platforms register an FCM token (iOS delivers via Firebase → APNs),
      // so always send through FCM — the backend has no direct-APNs path.
      const result = await push.send(
        'fcm',
        r.push_token,
        'Task reminder',
        r.title,
        { channel_key: 'before_task', task_id: r.task_id },
      );
      if (result.status === 'sent') sent++;
      else failed++;

      await db.$executeRawUnsafe(
        `update notification_deliveries
         set status = $1, provider_message_id = $2, error = $3
         where id = $4`,
        result.status,
        result.provider_message_id ?? null,
        result.error ?? null,
        deliveryId,
      );
    }

    return { scanned: rows.length, sent, failed };
  },
};
