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

/**
 * Reminders sent in parallel per batch.
 *
 * Bounded rather than unbounded: each delivery also runs two short queries, and
 * the Prisma pool is 2 connections per isolate, so firing all 200 at once would
 * queue every one of them behind the pool instead of behind FCM. 10 keeps the
 * network calls overlapping without turning the database into the bottleneck.
 */
const SWEEP_CONCURRENCY = 10;

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
    // Send to EVERY registered device for this user, not just the most recent
    // one. Otherwise a user signed in on two devices (e.g. iPhone + Android)
    // only ever gets the test on whichever registered last — so tapping "test"
    // on Android could deliver to their iPhone and look broken on Android.
    const devices = await tenantDb().deviceProfile.findMany({});
    const tokens = devices
      .map((d: { push_token: string | null }) => d.push_token)
      .filter((t: string | null): t is string => !!t && t.length > 0);
    if (tokens.length === 0) {
      throw new HttpError(400, 'No registered device to send a test push to');
    }

    // Always FCM — iOS registers an FCM token too (Firebase → APNs).
    let sent = 0;
    let lastError: string | undefined;
    for (const token of tokens) {
      const r = await push.send(
        'fcm',
        token,
        'Aqademiq',
        'This is a test notification 🎓',
        { channel_key: 'test' },
      );
      if (r.status === 'sent') sent++;
      else lastError = r.error ?? r.status;
    }

    return {
      id: crypto.randomUUID(),
      channel_key: 'test',
      status: sent > 0 ? 'sent' : 'failed',
      read: false,
      created_at: new Date(),
      provider: 'fcm',
      error: sent > 0 ? undefined : lastError,
      devices: tokens.length,
      sent,
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

    // The sweep runs every minute and takes at most `limit` rows. Hitting that
    // number exactly almost never means "there were exactly 200": it means there
    // were at least 200 and the rest were left behind. Because each pass reads
    // `reminder_at > now() - 2 days`, anything that keeps missing the cut for two
    // days is dropped permanently and nobody is told. Saying so turns a silent
    // data-loss mode into a line someone can alert on.
    if (rows.length >= limit) {
      console.warn(`[notifications] reminder sweep saturated at limit=${limit} — reminders are being deferred and may expire unsent`);
    }

    let sent = 0;
    let failed = 0;

    /** Claim, send, and record one reminder. Safe to run concurrently: the
     *  claim is an INSERT ... ON CONFLICT DO NOTHING on dedup_key, so exactly
     *  one worker can ever own a given task's delivery. */
    const deliver = async (r: DueReminderRow) => {
      const claim = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `insert into notification_deliveries (user_id, kind, task_id, dedup_key, status)
         values ($1, 'before_task', $2, $3, 'pending')
         on conflict (dedup_key) do nothing
         returning id`,
        r.user_id,
        r.task_id,
        `before_task:${r.task_id}`,
      );
      if (claim.length === 0) return; // another sweep already took it
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
    };

    // Sending one at a time made the sweep's duration the sum of every FCM round
    // trip: at ~150ms each, 200 reminders take 30s of a 60s window, and a slow
    // FCM turns "a few late reminders" into a backlog the next pass inherits.
    // Batching bounds wall-clock at (rows / CONCURRENCY) round trips while
    // keeping the DB pool (2 per isolate) from being swamped — the awaited
    // queries inside `deliver` are short and the fetch to FCM is the long part.
    for (let i = 0; i < rows.length; i += SWEEP_CONCURRENCY) {
      const batch = rows.slice(i, i + SWEEP_CONCURRENCY);
      // allSettled, not all: one token that throws must not abandon the rest of
      // the batch, and each failure is already recorded per row.
      const results = await Promise.allSettled(batch.map(deliver));
      for (const res of results) {
        if (res.status === 'rejected') {
          failed++;
          console.warn('[notifications] reminder delivery threw:', res.reason);
        }
      }
    }

    return { scanned: rows.length, sent, failed, saturated: rows.length >= limit };
  },
};
