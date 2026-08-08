// Ada agent — speaking first.
//
// Everything else in this directory is reactive: Ada exists only while the user
// is typing at it. This is the half that notices. It rides the reminder sweep
// that pg_cron already fires every minute (POST /cron/notifications), so no new
// schedule is needed.
//
// Cost is the whole design problem. A naive "check in twice a day" costs
// 2 × users × turns provider calls per day, which would exhaust the free-tier
// pool long before it became useful. So the work is two-stage, and the expensive
// stage almost never runs:
//
//   Stage 1  ONE indexed SQL query across all users. It answers "is anyone at
//            their check-in time right now AND is there anything worth saying?"
//            On the overwhelming majority of the 1,440 sweeps in a day it
//            returns zero rows and costs nothing.
//   Stage 2  Only for those users, and only after winning an atomic claim: run
//            the agent on a deliberately small budget, persist what it says as a
//            real Ada message, and push a short form of it.
//
// Three independent brakes on spend, because the failure mode here is not a bug
// but a bill:
//   * per user/day/kind — the dedup claim in notification_deliveries
//   * per sweep         — MAX_PER_SWEEP
//   * per day globally  — DAILY_RUN_CAP, counted from the same table
//
// And it is OFF unless ADA_NUDGES_ENABLED=1. Turning a system on that messages
// real people unprompted should be a deliberate act, not a side effect of a
// deploy.

import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { env } from '../../_shared/env.ts';
import { push } from '../../_shared/push.ts';
import { claude } from '../../_shared/claude.ts';
import { runAgent } from './runtime.ts';

/** Minutes after their configured time that a check-in may still fire. Wide
 *  enough to survive a missed sweep; the daily claim stops it repeating. */
const WINDOW_MINUTES = 15;
/** Users handled in a single sweep. The window above spreads the rest. */
const MAX_PER_SWEEP = 3;
/** Hard ceiling on agent runs per UTC day, across every user. */
const DAILY_RUN_CAP = intEnv('ADA_NUDGE_DAILY_CAP', 50);
/** A nudge is one short message; it does not get a planning session's budget. */
const NUDGE_DEADLINE_MS = intEnv('ADA_NUDGE_DEADLINE_MS', 18_000);
const NUDGE_MAX_CALLS = intEnv('ADA_NUDGE_MAX_CALLS', 4);
/** Push bodies are truncated by the OS anyway; keep it to a glanceable line. */
const PUSH_BODY_CHARS = 160;
/** Horizon that counts as "coming up" when deciding there is anything to say. */
const LOOKAHEAD_DAYS = 3;

function intEnv(name: string, fallback: number): number {
  const raw = Number(env(name));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function nudgesEnabled(): boolean {
  return env('ADA_NUDGES_ENABLED') === '1';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Optional allowlist of user ids that may receive check-ins.
 *
 * ADA_NUDGES_ENABLED is all-or-nothing, which is the wrong shape for the first
 * run of anything that messages people unprompted: turning it on means every
 * eligible user hears from Ada on the very next minute tick, before anyone has
 * read a single generated message. This narrows that to a named few, so the
 * feature can be tried on your own account first and widened deliberately.
 *
 * Purely a narrowing filter — every other gate (check-in window, having something
 * worth saying, the daily claim, the caps) still applies to the listed users.
 * Unset means no restriction, which is the eventual steady state.
 *
 * Malformed entries are dropped rather than passed to the query: a typo'd id
 * should match nobody, not become a SQL fragment.
 *
 * `restricted` is tracked separately from the id list precisely so a mistyped
 * value cannot fail OPEN. Collapsing "set, but nothing in it parsed" into the
 * same empty list as "not set at all" would turn one typo into a broadcast to
 * every eligible user — the exact outcome this exists to prevent.
 */
interface Allowlist {
  /** True when ADA_NUDGE_ONLY_USERS was set to anything non-empty. */
  restricted: boolean;
  ids: string[];
}

function nudgeAllowlist(): Allowlist {
  const raw = (env('ADA_NUDGE_ONLY_USERS') ?? '').trim();
  if (!raw) return { restricted: false, ids: [] };

  const ids = raw.split(',').map((s) => s.trim()).filter((s) => UUID.test(s));
  if (ids.length === 0) {
    console.warn(
      '[ada-nudge] ADA_NUDGE_ONLY_USERS is set but contains no valid user ids; ' +
        'nudging nobody. Fix or unset it.',
    );
  }
  return { restricted: true, ids };
}

/**
 * The filter value for the query.
 *
 * '' means no restriction. A restricted-but-empty list must NOT become '', so it
 * is sent as a token that cannot equal any uuid and therefore matches nobody.
 */
function allowlistParam(a: Allowlist): string {
  if (!a.restricted) return '';
  return a.ids.length > 0 ? a.ids.join(',') : 'none';
}

type NudgeKind = 'morning' | 'evening';

interface Candidate {
  user_id: string;
  timezone: string;
  push_token: string;
  kind: NudgeKind;
  local_date: string;
  due_soon: number;
  overdue: number;
}

/**
 * Everyone who should hear from Ada right now.
 *
 * The `distinct on (p.id)` matters: a user with several registered devices would
 * otherwise appear once per device and be nudged repeatedly.
 *
 * The `due_soon > 0 or overdue > 0` filter is what makes silence the default. A
 * check-in with nothing to check in about is worse than no check-in — it teaches
 * the user to ignore the notification.
 *
 * The `elapsed` CTE computes minutes since the configured check-in time as
 * modular arithmetic — `(1440 + diff) % 1440` — rather than the obvious
 * `local_time between t and t + interval '15 minutes'`. Postgres `time`
 * arithmetic wraps at midnight, so for a 23:55 check-in the naive range becomes
 * `>= 23:55 and < 00:10`, which is empty: that user would silently never be
 * nudged, with nothing in the logs to explain it. Verified against production
 * timezones — an Asia/Kolkata user at local 20:56 with a 20:00 review correctly
 * reads 57 minutes elapsed.
 */
async function findCandidates(limit: number, allowlist: Allowlist): Promise<Candidate[]> {
  return await prismaBase().$queryRawUnsafe<Candidate[]>(
    `with base as (
       select distinct on (p.id)
         p.id                                        as user_id,
         coalesce(p.timezone, 'UTC')                 as timezone,
         (now() at time zone coalesce(p.timezone, 'UTC')) as local_now,
         d.push_token,
         np.morning_checkin_enabled, np.morning_checkin_time,
         np.evening_review_enabled,  np.evening_review_time
       from profiles p
       join notification_preferences np on np.user_id = p.id
       join device_profiles d
         on d.user_id = p.id and d.push_token is not null and d.push_token <> ''
       where np.push_enabled = true
         -- Empty string = no allowlist = everyone. Passed as text rather than a
         -- uuid[] so the shape does not depend on how the driver adapts arrays.
         and ($4 = '' or p.id::text = any(string_to_array($4, ',')))
       order by p.id, d.id desc
     ),
     elapsed as (
       select b.*,
         (1440 + (extract(epoch from (b.local_now::time - b.morning_checkin_time)) / 60)::int) % 1440 as since_morning,
         (1440 + (extract(epoch from (b.local_now::time - b.evening_review_time))  / 60)::int) % 1440 as since_evening
       from base b
     ),
     matched as (
       select e.*,
         case
           when e.morning_checkin_enabled and e.since_morning < $1 then 'morning'
           when e.evening_review_enabled  and e.since_evening < $1 then 'evening'
         end as kind
       from elapsed e
     ),
     scored as (
       select m.user_id, m.timezone, m.push_token, m.kind,
              m.local_now::date as local_date,
              (select count(*) from tasks t
                where t.user_id = m.user_id and t.status = 'pending'
                  and t.due_at::date between m.local_now::date
                                         and m.local_now::date + $2) as due_soon,
              (select count(*) from tasks t
                where t.user_id = m.user_id and t.status = 'pending'
                  and t.due_at::date < m.local_now::date)            as overdue
       from matched m
       where m.kind is not null
     )
     select * from scored s
     where (s.due_soon > 0 or s.overdue > 0)
       -- Don't pile on: they already have proposals waiting for a decision.
       and not exists (
         select 1 from ada_pending_actions a
         where a.user_id = s.user_id and a.status = 'pending'
       )
       -- Cheap pre-filter; the claim below is what actually prevents duplicates.
       and not exists (
         select 1 from notification_deliveries nd
         where nd.dedup_key = 'nudge:' || s.user_id::text || ':' || s.local_date::text || ':' || s.kind
       )
     order by s.overdue desc, s.due_soon desc
     limit $3`,
    WINDOW_MINUTES,
    LOOKAHEAD_DAYS,
    limit,
    allowlistParam(allowlist),
  );
}

/** Runs today, from the same table that dedups them. Bounds the daily spend. */
async function runsToday(): Promise<number> {
  const rows = await prismaBase().$queryRawUnsafe<Array<{ n: number }>>(
    `select count(*)::int as n from notification_deliveries
      where kind = 'ada_nudge' and created_at >= date_trunc('day', now())`,
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Claim the right to nudge this user today. Returns the delivery row id, or null
 * if another sweep got there first.
 *
 * Same claim-before-send shape the reminder sweep uses: the unique index on
 * dedup_key is what makes it race-safe, so two overlapping sweeps cannot both
 * decide to message the same person.
 */
async function claim(userId: string, localDate: string, kind: NudgeKind): Promise<string | null> {
  const rows = await prismaBase().$queryRawUnsafe<Array<{ id: string }>>(
    `insert into notification_deliveries (user_id, kind, dedup_key, status)
     values ($1, 'ada_nudge', $2, 'pending')
     on conflict (dedup_key) do nothing
     returning id`,
    userId,
    `nudge:${userId}:${localDate}:${kind}`,
  );
  return rows[0]?.id ?? null;
}

/**
 * The conversation a check-in lands in.
 *
 * Reuses the user's most recent active session so the nudge appears where they
 * are already talking to Ada, and so the run inherits that conversation's
 * history and digest. Only starts a new one when there is nothing recent to join.
 */
async function sessionFor(userId: string): Promise<string> {
  const existing = await prismaBase().adaSession.findFirst({
    where: { user_id: userId, is_active: true },
    orderBy: { updated_at: 'desc' },
  });
  if (existing) return existing.id;
  const created = await prismaBase().adaSession.create({
    data: { user_id: userId, title: 'Check-ins', session_type: 'review' },
  });
  return created.id;
}

function goalFor(c: Candidate): string {
  const when = c.kind === 'morning'
    ? 'It is the start of their day.'
    : 'It is the end of their day.';

  return [
    'This is a proactive check-in. The user has NOT asked you anything — you are',
    'starting this conversation, and they will see it as a notification.',
    when,
    `They have ${c.due_soon} task(s) due in the next ${LOOKAHEAD_DAYS} days and ${c.overdue} overdue.`,
    '',
    c.kind === 'morning'
      ? 'Look at what is coming and tell them the one thing that matters most today.'
      : 'Look at how today went and at what is coming tomorrow.',
    '',
    'Rules for this message specifically:',
    '- Two sentences at most. It has to be readable on a lock screen.',
    '- Say something specific and true about THEIR work — a real task, a real',
    '  date. Never generic encouragement.',
    '- Propose a change only when it clearly helps (something due with no time',
    '  set aside, a task they keep moving). At most two proposals. They will see',
    '  the cards when they open the app.',
    '- If nothing genuinely needs saying, say only a brief honest line and',
    '  propose nothing. A quiet day is a fine thing to report.',
    '- Do not greet them by name every time or ask how they are.',
  ].join('\n');
}

export interface NudgeResult {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * One proactive pass. Safe to call on every sweep: it returns immediately when
 * disabled, when nobody is in a check-in window, or when the daily cap is spent.
 */
export async function runNudgeSweep(): Promise<NudgeResult> {
  const result: NudgeResult = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  if (!nudgesEnabled() || !claude.isConfigured()) return result;

  const allowlist = nudgeAllowlist();
  const candidates = await findCandidates(MAX_PER_SWEEP, allowlist);
  result.scanned = candidates.length;
  if (candidates.length === 0) {
    // Logged only when there was nothing to do AND a restriction is in force, so
    // "why did nobody get one?" has an answer in the logs rather than looking
    // like the feature is broken.
    if (allowlist.restricted) {
      console.log(`[ada-nudge] allowlist active (${allowlist.ids.length} user(s)); no candidates this sweep`);
    }
    return result;
  }

  // Checked once per sweep rather than per user: it is a global brake, and the
  // per-sweep cap already bounds how far past it a single pass can go.
  if (await runsToday() >= DAILY_RUN_CAP) {
    result.skipped = candidates.length;
    console.warn(`[ada-nudge] daily cap ${DAILY_RUN_CAP} reached; skipping ${candidates.length}`);
    return result;
  }

  for (const c of candidates) {
    const deliveryId = await claim(c.user_id, c.local_date, c.kind);
    if (!deliveryId) {
      result.skipped++;
      continue;
    }

    try {
      await nudgeOne(c, deliveryId);
      result.sent++;
    } catch (e) {
      result.failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error('[ada-nudge] failed', JSON.stringify({ user: c.user_id, kind: c.kind, error: message }));
      await prismaBase().$executeRawUnsafe(
        `update notification_deliveries set status = 'failed', error = $1 where id = $2`,
        message.slice(0, 500),
        deliveryId,
      );
    }
  }

  return result;
}

/**
 * Produce and deliver one check-in.
 *
 * The whole thing runs inside RequestContext.run so the agent, its tools and the
 * Prisma tenancy wrapper all operate as this user — the sweep itself has no
 * identity, and without this every tenant-scoped query would throw.
 */
async function nudgeOne(c: Candidate, deliveryId: string): Promise<void> {
  await RequestContext.run(
    { userId: c.user_id, isGuest: false, sessionId: `nudge:${deliveryId}` },
    async () => {
      const sessionId = await sessionFor(c.user_id);

      const outcome = await runAgent({
        sessionId,
        // No trigger message: nobody said anything. This is what distinguishes a
        // nudge run from a reply in ada_agent_runs.
        messageId: null,
        goal: goalFor(c),
        budget: { deadlineMs: NUDGE_DEADLINE_MS, maxCalls: NUDGE_MAX_CALLS },
      });

      const text = outcome.text.trim();
      if (!text) throw new Error('agent produced no text');

      // Persisted before the push. If delivery fails the message is still in the
      // app, which is the more durable channel — a push is a pointer to it, not
      // the thing itself.
      const message = await prismaBase().adaMessage.create({
        data: {
          ada_session_id: sessionId,
          role: 'assistant',
          content: text,
          model: outcome.usage.model,
          prompt_tokens: outcome.usage.prompt_tokens,
          completion_tokens: outcome.usage.completion_tokens,
          metadata: {
            run_id: outcome.run_id,
            agent_status: outcome.status,
            // deno-lint-ignore no-explicit-any
            agent_plan: outcome.plan as any,
            pending_action_ids: outcome.pending_action_ids,
            llm_calls: outcome.usage.llm_calls,
            proactive: true,
            nudge_kind: c.kind,
          },
        },
      });

      if (outcome.pending_action_ids.length) {
        await prismaBase().adaPendingAction.updateMany({
          where: { id: { in: outcome.pending_action_ids } },
          data: { message_id: message.id },
        });
      }

      await prismaBase().adaSession.update({
        where: { id: sessionId },
        data: { updated_at: new Date() },
      });

      const body = text.length > PUSH_BODY_CHARS ? `${text.slice(0, PUSH_BODY_CHARS - 1)}…` : text;
      const sent = await push.send(
        'fcm',
        c.push_token,
        c.kind === 'morning' ? 'Ada · your day' : 'Ada · today in review',
        body,
        {
          channel_key: 'ada_nudge',
          conversation_id: sessionId,
          message_id: message.id,
          // Lets the client badge the notification when there is something to act on.
          action_count: String(outcome.pending_action_ids.length),
        },
      );

      await prismaBase().$executeRawUnsafe(
        `update notification_deliveries
            set status = $1, provider_message_id = $2, error = $3
          where id = $4`,
        sent.status,
        sent.provider_message_id ?? null,
        sent.error ?? null,
        deliveryId,
      );
    },
  );
}
