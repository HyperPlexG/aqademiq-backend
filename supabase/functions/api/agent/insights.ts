// Ada agent — what actually happened to the plans it made.
//
// Ada proposed work and never found out whether any of it got done. The evidence
// was already being recorded and simply never read: task_reschedule_history rows
// pile up every time something slips, and focus_sessions carry was_completed,
// actual_duration_mins and interruption_count for every attempt. An agent that
// cannot see those keeps confidently proposing the same 3-hour block that the
// user has abandoned four times.
//
// Two deliberate choices:
//
//  1. These are COMPUTED per run, not stored as memories. A derived statistic
//     goes stale the moment behaviour changes, and a stored "abandons long
//     sessions" would outlive the habit and quietly become a lie. ada_memories
//     is for what cannot be derived — things the user stated. This is for what
//     can, so it is recalculated instead of remembered.
//  2. It is pure SQL. No provider call, so the agent gets self-knowledge for
//     free, which matters on a quota the rest of the system is rationing.

import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';

/** Behaviour older than this says little about how the user works now. */
const WINDOW_DAYS = 60;
/** Below this there isn't enough evidence to say anything honest. */
const MIN_FOCUS_SESSIONS = 6;
const MIN_MOVES_TO_FLAG = 2;
/** A "session" shorter than this is a mis-tap, not evidence about attention span. */
const MIN_MEANINGFUL_MINUTES = 5;
const MAX_STRUGGLING = 3;
const MAX_BACKLOG_SUBJECTS = 3;

export interface FocusInsight {
  completed: number;
  abandoned: number;
  abandon_rate: number;
  median_completed_mins: number | null;
  median_abandoned_mins: number | null;
  avg_interruptions: number | null;
}

export interface StrugglingTask {
  task_id: string;
  title: string;
  moves: number;
}

export interface BacklogSubject {
  subject: string;
  overdue: number;
}

export interface Insights {
  focus: FocusInsight | null;
  struggling: StrugglingTask[];
  backlog: BacklogSubject[];
}

const EMPTY: Insights = { focus: null, struggling: [], backlog: [] };

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read the behavioural record.
 *
 * Three independent aggregates issued together. Raw SQL rather than Prisma
 * because these are `filter (where …)` aggregates and a median, which the query
 * builder cannot express — and doing them in one round trip each keeps this off
 * the critical path of every run.
 *
 * Every query is parameterised on the caller's user id: this bypasses the
 * tenantDb() extension, so tenancy is enforced here explicitly rather than
 * inherited.
 */
export async function buildInsights(): Promise<Insights> {
  const userId = RequestContext.userId;
  try {
    const [focusRows, strugglingRows, backlogRows] = await Promise.all([
      prismaBase().$queryRawUnsafe<Array<Record<string, unknown>>>(
        `select
           count(*) filter (where was_completed)                                as completed,
           count(*) filter (where not was_completed)                            as abandoned,
           percentile_cont(0.5) within group (order by actual_duration_mins)
             filter (where was_completed and actual_duration_mins is not null)  as median_completed,
           percentile_cont(0.5) within group (order by actual_duration_mins)
             filter (where not was_completed and actual_duration_mins is not null) as median_abandoned,
           avg(interruption_count)                                              as avg_interruptions
         from focus_sessions
         where user_id = $1::uuid
           and started_at > now() - ($2 || ' days')::interval`,
        userId,
        String(WINDOW_DAYS),
      ),
      prismaBase().$queryRawUnsafe<Array<Record<string, unknown>>>(
        `select t.id as task_id, t.title, count(*) as moves
         from task_reschedule_history h
         join tasks t on t.id = h.task_id
         where t.user_id = $1::uuid
           and t.status = 'pending'
           and h.created_at > now() - ($2 || ' days')::interval
         group by t.id, t.title
         having count(*) >= $3
         order by count(*) desc
         limit $4`,
        userId,
        String(WINDOW_DAYS),
        MIN_MOVES_TO_FLAG,
        MAX_STRUGGLING,
      ),
      prismaBase().$queryRawUnsafe<Array<Record<string, unknown>>>(
        `select c.name as subject, count(*) as overdue
         from tasks t
         join courses c on c.id = t.course_id
         where t.user_id = $1::uuid
           and t.status = 'pending'
           and t.due_at < current_date
         group by c.name
         order by count(*) desc
         limit $2`,
        userId,
        MAX_BACKLOG_SUBJECTS,
      ),
    ]);

    const f = focusRows[0] ?? {};
    const completed = num(f.completed) ?? 0;
    const abandoned = num(f.abandoned) ?? 0;
    const total = completed + abandoned;

    return {
      // Withheld below the threshold: "you abandon 100% of sessions" off two
      // data points is noise the agent would act on as though it were a fact.
      focus: total >= MIN_FOCUS_SESSIONS
        ? {
          completed,
          abandoned,
          abandon_rate: Math.round((abandoned / total) * 100) / 100,
          median_completed_mins: num(f.median_completed),
          median_abandoned_mins: num(f.median_abandoned),
          avg_interruptions: num(f.avg_interruptions),
        }
        : null,
      struggling: strugglingRows.map((r) => ({
        task_id: String(r.task_id),
        title: String(r.title),
        moves: num(r.moves) ?? 0,
      })),
      backlog: backlogRows.map((r) => ({
        subject: String(r.subject),
        overdue: num(r.overdue) ?? 0,
      })),
    };
  } catch (e) {
    // Self-knowledge is an enhancement; a run must never fail for lack of it.
    console.warn('[ada-insights] failed', e instanceof Error ? e.message : e);
    return EMPTY;
  }
}

/**
 * The insight block for the system prompt.
 *
 * Written as observations with their evidence attached, so the agent can cite
 * why it is suggesting something ("you've moved this four times") instead of
 * asserting a judgement about the user that it cannot support.
 */
export function renderInsights(i: Insights): string {
  const lines: string[] = [];

  if (i.focus) {
    const pct = Math.round(i.focus.abandon_rate * 100);
    const parts = [`They finish ${i.focus.completed} of ${i.focus.completed + i.focus.abandoned} focus sessions (${pct}% abandoned).`];
    // Stated only when both medians are real durations AND differ enough to act
    // on. The floor matters: sessions are recorded with actual_duration_mins = 0
    // (a start with no meaningful elapsed time), and without it the comparison
    // trivially passes and the agent is told finished sessions "run about 0 min",
    // which it would then use to size real study blocks.
    if (
      i.focus.median_completed_mins !== null && i.focus.median_abandoned_mins !== null &&
      i.focus.median_completed_mins >= MIN_MEANINGFUL_MINUTES &&
      i.focus.median_abandoned_mins >= MIN_MEANINGFUL_MINUTES &&
      i.focus.median_abandoned_mins > i.focus.median_completed_mins * 1.25
    ) {
      parts.push(
        `Sessions they finish run about ${Math.round(i.focus.median_completed_mins)} min; ` +
          `the ones they abandon are longer, about ${Math.round(i.focus.median_abandoned_mins)} min — ` +
          'so prefer blocks near the shorter length.',
      );
    }
    if (i.focus.avg_interruptions !== null && i.focus.avg_interruptions >= 2) {
      parts.push(`They average ${i.focus.avg_interruptions.toFixed(1)} interruptions per session.`);
    }
    lines.push(...parts.map((p) => `- ${p}`));
  }

  for (const s of i.struggling) {
    lines.push(
      `- “${s.title}” has been rescheduled ${s.moves} times and is still open — it is probably too big or badly placed. Consider breaking it down or asking about it.`,
    );
  }

  if (i.backlog.length) {
    const worst = i.backlog.map((b) => `${b.subject} (${b.overdue})`).join(', ');
    lines.push(`- Overdue and still pending: ${worst}.`);
  }

  if (lines.length === 0) return '';

  return [
    '## What their history shows',
    'Observed from their actual behaviour, not something they told you. Use it to',
    'make better proposals; mention it only when it helps them, and never as a',
    'criticism.',
    ...lines,
  ].join('\n');
}
