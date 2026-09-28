// §2.9 — notifications inbox/history + test push. Port of
// src/features/notifications/notifications.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { HttpError } from '../../_shared/http.ts';
import { isTokenDead, push, type PushResult } from '../../_shared/push.ts';

interface DueReminderRow {
  task_id: string;
  user_id: string;
  title: string;
  device_id: string;
  push_token: string;
  device_type: string | null;
}

/**
 * Extra tokens to try for one reminder when the newest turns out to be dead.
 *
 * Each dead token is deleted before the next is tried, so the candidate list
 * strictly shrinks and this cannot loop. Retrying in-tick rather than leaving it
 * to the next minute is what keeps a reminder punctual for someone who has
 * reinstalled a few times — otherwise a stack of n dead tokens delays them by n
 * minutes, and a task reminder that lands late has already failed at its job.
 */
const MAX_TOKEN_RETRIES = 2;

interface AnnouncementRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  audience: string;
}

/** One user's current best-guess device: the newest token they registered. */
interface PushTarget {
  user_id: string;
  device_id: string;
  push_token: string;
  device_type: string | null;
}

/**
 * Send to a user's newest device, deleting tokens FCM declares dead and falling
 * through to the next one, up to [MAX_TOKEN_RETRIES] extra attempts.
 *
 * Returns the device the last attempt actually used, so the caller can record
 * where the notification really went rather than where it started.
 *
 * Shared by reminders and announcements on purpose: a broadcast is the single
 * biggest source of dead tokens (it touches every account at once, including
 * ones dormant for months), so it is the last place that should be running its
 * own copy of this logic.
 */
async function sendPruningDeadTokens(
  db: ReturnType<typeof prismaBase>,
  target: PushTarget,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ result: PushResult; deviceId: string; deviceType: string | null }> {
  let deviceId = target.device_id;
  let deviceType = target.device_type;
  let token = target.push_token;
  let result: PushResult;

  for (let attempt = 0; ; attempt++) {
    // Both platforms register an FCM token (iOS delivers via Firebase → APNs),
    // so always send through FCM — the backend has no direct-APNs path.
    result = await push.send('fcm', token, title, body, data);
    if (result.status === 'sent' || !isTokenDead(result.error)) break;

    // FCM has told us this token is gone for good. Deleting it is the only thing
    // that stops it being chosen again — nothing else in the system ever removed
    // a dead token, which is how seven accumulated on one account. The delete is
    // also what bounds this loop.
    await db.$executeRawUnsafe('delete from device_profiles where id = $1', deviceId);
    console.warn(`[notifications] pruned dead token: device=${deviceId} user=${target.user_id}`);
    if (attempt >= MAX_TOKEN_RETRIES) break;

    const next = await db.$queryRawUnsafe<Array<{ id: string; push_token: string; device_type: string | null }>>(
      `select id, push_token, device_type from device_profiles
       where user_id = $1 and push_token is not null and push_token <> ''
       order by updated_at desc, id desc
       limit 1`,
      target.user_id,
    );
    if (next.length === 0) break; // no devices left to try
    deviceId = next[0].id;
    deviceType = next[0].device_type;
    token = next[0].push_token;
  }

  return { result, deviceId, deviceType };
}

/**
 * Recipients per minute tick for a broadcast.
 *
 * An announcement is delivered across ticks rather than in one pass: the edge
 * isolate has a wall-clock budget, and one pass over tens of thousands of
 * accounts would be killed part-way through. Because each recipient is claimed
 * by a per-user dedup key, being killed part-way is harmless — the next tick
 * picks up exactly the ones that were not reached, and nobody is sent the same
 * announcement twice.
 */
const ANNOUNCE_BATCH = 500;

/** The claim key for one user's copy of one announcement. */
export function announcementDedupKey(slug: string, userId: string): string {
  return `announce:${slug}:${userId}`;
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
    const targets = devices
      .filter((d: { push_token: string | null }) => !!d.push_token && d.push_token.length > 0)
      .map((d: { id: string; push_token: string | null }) => ({ id: d.id, token: d.push_token! }));
    if (targets.length === 0) {
      throw new HttpError(400, 'No registered device to send a test push to');
    }

    // Always FCM — iOS registers an FCM token too (Firebase → APNs).
    let sent = 0;
    let lastError: string | undefined;
    for (const target of targets) {
      const r = await push.send(
        'fcm',
        target.token,
        'Aqademiq',
        'This is a test notification 🎓',
        { channel_key: 'test' },
      );
      if (r.status === 'sent') sent++;
      else lastError = r.error ?? r.status;
      // Sending to every device is right for a test button (see above), but it
      // also means this is where dead tokens surface first. Prune them here too,
      // or "0 of 7 sent" is the answer forever and the button looks broken while
      // the one live phone is sitting right there.
      if (isTokenDead(r.error)) {
        await tenantDb().deviceProfile.deleteMany({ where: { id: target.id } });
        console.warn(`[notifications] pruned dead token on test push: device=${target.id}`);
      }
    }

    return {
      id: crypto.randomUUID(),
      channel_key: 'test',
      status: sent > 0 ? 'sent' : 'failed',
      read: false,
      created_at: new Date(),
      provider: 'fcm',
      error: sent > 0 ? undefined : lastError,
      devices: targets.length,
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
  /**
   * Deliver the oldest active broadcast to everyone not yet reached, then stop.
   *
   * Fired by inserting a row into `announcements` — there is no endpoint, which
   * is deliberate: a broadcast cannot be recalled, so the trigger is a row an
   * operator writes with SQL, not something reachable over HTTP with a header.
   *
   * One announcement at a time, oldest first, so two rows queued by mistake go
   * out in sequence instead of interleaving. When a pass finds nobody left it
   * marks the row `done` and the next one starts on the following tick.
   *
   * Audience:
   *   'opted_in' — only accounts that have explicitly enabled push.
   *   'all'      — also accounts that never expressed a preference.
   * Neither ever reaches someone who explicitly turned push OFF: the `coalesce`
   * only fills in a NULL, so an explicit `false` is always respected. That is
   * the one line here worth not breaking.
   */
  async runAnnouncementSweep(limit = ANNOUNCE_BATCH) {
    const db = prismaBase();

    const active = await db.$queryRawUnsafe<Array<AnnouncementRow>>(
      `select id, slug, title, body, audience from announcements
       where status = 'active' order by created_at asc limit 1`,
    );
    if (active.length === 0) return { announcement: null as string | null, sent: 0, failed: 0, remaining: 0 };
    const a = active[0];
    const includeUnset = a.audience === 'all';

    const rows = await db.$queryRawUnsafe<PushTarget[]>(
      `with newest_device as (
         select distinct on (user_id)
                user_id, id as device_id, push_token, device_type
         from device_profiles
         where push_token is not null and push_token <> ''
         order by user_id, updated_at desc, id desc
       )
       select d.user_id, d.device_id, d.push_token, d.device_type
       from newest_device d
       left join notification_preferences np on np.user_id = d.user_id
       left join notification_deliveries nd on nd.dedup_key = $1 || d.user_id::text
       where nd.id is null
         and coalesce(np.push_enabled, $2) = true
       limit ${Number(limit)}`,
      `announce:${a.slug}:`,
      includeUnset,
    );

    if (rows.length === 0) {
      await db.$executeRawUnsafe(
        `update announcements set status = 'done', updated_at = now() where id = $1`,
        a.id,
      );
      console.info(`[notifications] announcement "${a.slug}" complete`);
      return { announcement: a.slug, sent: 0, failed: 0, remaining: 0 };
    }

    let sent = 0;
    let failed = 0;

    const deliver = async (t: PushTarget) => {
      const claim = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `insert into notification_deliveries (user_id, kind, dedup_key, status, device_id, device_type)
         values ($1, 'announcement', $2, 'pending', $3, $4)
         on conflict (dedup_key) do nothing
         returning id`,
        t.user_id,
        announcementDedupKey(a.slug, t.user_id),
        t.device_id,
        t.device_type,
      );
      if (claim.length === 0) return; // a concurrent tick already took this user
      const deliveryId = claim[0].id;

      const { result, deviceId, deviceType } = await sendPruningDeadTokens(
        db,
        t,
        a.title,
        a.body,
        { channel_key: 'announcement', announcement: a.slug },
      );
      if (result.status === 'sent') sent++;
      else failed++;

      await db.$executeRawUnsafe(
        `update notification_deliveries
         set status = $1, provider_message_id = $2, error = $3, device_id = $4, device_type = $5
         where id = $6`,
        result.status,
        result.provider_message_id ?? null,
        result.error ?? null,
        deviceId,
        deviceType,
        deliveryId,
      );
    };

    for (let i = 0; i < rows.length; i += SWEEP_CONCURRENCY) {
      const batch = rows.slice(i, i + SWEEP_CONCURRENCY);
      const results = await Promise.allSettled(batch.map(deliver));
      for (const res of results) {
        if (res.status === 'rejected') {
          failed++;
          console.warn('[notifications] announcement delivery threw:', res.reason);
        }
      }
    }

    await db.$executeRawUnsafe(
      `update announcements
       set sent_count = sent_count + $1, failed_count = failed_count + $2, updated_at = now()
       where id = $3`,
      sent,
      failed,
      a.id,
    );

    console.info(`[notifications] announcement "${a.slug}": sent=${sent} failed=${failed} batch=${rows.length}`);
    return { announcement: a.slug, sent, failed, remaining: rows.length >= limit ? -1 : 0 };
  },

  async runReminderSweep(limit = 200) {
    const db = prismaBase();

    // `distinct on` is load-bearing, not tidiness. Joining device_profiles
    // directly fans one due task out to one row PER REGISTERED DEVICE, and since
    // every FCM token rotates on reinstall, a user who has reinstalled six times
    // has seven rows — six of them permanently dead. All seven then race to claim
    // the same dedup_key and exactly one wins, chosen by whichever INSERT reaches
    // Postgres first: a 6-in-7 chance of spending the reminder on a corpse and
    // then having the claim block any retry. Observed in production — an account
    // with seven tokens got nothing from 2026-08-16 onward while the database
    // reported a registered device and enabled preferences.
    //
    // Newest device wins (product decision, 2026-09-28): one reminder, one phone,
    // the one most recently seen. It also makes `limit` mean what it says —
    // reminders, not task×device pairs.
    const rows = await db.$queryRawUnsafe<DueReminderRow[]>(`
      with newest_device as (
        select distinct on (user_id)
               user_id, id as device_id, push_token, device_type
        from device_profiles
        where push_token is not null and push_token <> ''
        order by user_id, updated_at desc, id desc
      )
      select t.id as task_id, t.user_id, t.title,
             d.device_id, d.push_token, d.device_type
      from tasks t
      join notification_preferences np on np.user_id = t.user_id
      join newest_device d on d.user_id = t.user_id
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
        `insert into notification_deliveries (user_id, kind, task_id, dedup_key, status, device_id, device_type)
         values ($1, 'before_task', $2, $3, 'pending', $4, $5)
         on conflict (dedup_key) do nothing
         returning id`,
        r.user_id,
        r.task_id,
        `before_task:${r.task_id}`,
        r.device_id,
        r.device_type,
      );
      if (claim.length === 0) return; // another sweep already took it
      const deliveryId = claim[0].id;

      const { result, deviceId, deviceType } = await sendPruningDeadTokens(
        db,
        r,
        'Task reminder',
        r.title,
        { channel_key: 'before_task', task_id: r.task_id },
      );

      if (result.status === 'sent') sent++;
      else failed++;

      // Record which device the attempt finally landed on, not which one it
      // started with. Without this the table could not say whether a failure was
      // an iOS or an Android problem — the reason a platform breakdown was
      // impossible for every delivery before today.
      await db.$executeRawUnsafe(
        `update notification_deliveries
         set status = $1, provider_message_id = $2, error = $3, device_id = $4, device_type = $5
         where id = $6`,
        result.status,
        result.provider_message_id ?? null,
        result.error ?? null,
        deviceId,
        deviceType,
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
