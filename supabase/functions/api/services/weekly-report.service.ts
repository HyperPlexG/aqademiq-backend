// GET /v1/me/weekly-report — the one read behind the weekly Core.
//
// This endpoint returns *facts only*. No sentence, no label, no adjective ever
// crosses the wire. Every word the student reads is templated on the client,
// where the banned-vocabulary lint can see it as a string literal; a server that
// shipped prose would move that copy somewhere the lint cannot reach, and the
// whole safety contract is only as good as its enforceability.
//
// Why one endpoint instead of the client composing five:
//
//  * The report is a single screen that must appear all at once. Five sequential
//    round-trips on a cold isolate is a visibly assembling dashboard, which is
//    the exact thing the design is not.
//  * `has_activity` has to be decided from the union of every kind of evidence
//    (§ below). Split across endpoints, the client would have to re-derive it,
//    and any disagreement between the two draws a day someone worked as empty.
//
// Everything here reads through indexes that already exist in production —
// focus_sessions_user_completed_started_idx, idx_mood_checkins_user_date,
// idx_daily_activity_user_date — plus one added alongside this file for
// tasks.completed_at. No table is scanned.
import { tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { cacheGet, cacheSet } from '../../_shared/redis.ts';
import { toUtcDate, ymd } from '../../_shared/occurs-on.ts';
import { streaksService } from './streaks.service.ts';

const MS_PER_DAY = 86_400_000;

/** Short, because the numbers move whenever the student does anything. */
const REPORT_TTL = 120;

/** How far back "your rhythm" looks for weekdays that reliably carry work. */
const RHYTHM_WEEKS = 8;

/**
 * A weekday only counts as part of someone's rhythm if it carried work on more
 * than half the weeks observed. Lower than this and the report would name a day
 * off a single coincidence, which reads as a claim about the person rather than
 * an observation about the data.
 */
const RHYTHM_MIN_SHARE = 0.5;

/** Weeks of history needed before "your rhythm" is allowed to say anything. */
const RHYTHM_MIN_WEEKS = 3;

export type WeekShape =
  | 'empty' // nothing at all
  | 'single' // exactly one day
  | 'steady' // spread across the week
  | 'front_loaded' // the weight is early
  | 'back_loaded' // the weight is late
  | 'clustered' // a run of consecutive days
  | 'scattered'; // present but with no discernible pattern

export interface WeeklyReportDay {
  date: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** 0–4 on the shipped ramp, or null when nothing was logged. */
  mood_index: number | null;
  /** The union read — see `hasActivity` below. */
  has_activity: boolean;
  /**
   * A day later in the week than today. It has not happened yet, so it is
   * neither active nor a gap, and the client must not draw it as a day with
   * nothing logged — that would tell someone on Thursday that they had missed
   * Friday, Saturday and Sunday.
   */
  is_future: boolean;
  tasks_completed: number;
  focus_minutes: number;
  focus_sessions: number;
}

/** Monday of the ISO week containing `ref`, in UTC. */
export function mondayOf(ref: Date): Date {
  const dow = ref.getUTCDay();
  return toUtcDate(ymd(new Date(ref.getTime() + (dow === 0 ? -6 : 1 - dow) * MS_PER_DAY)));
}

/**
 * Classify the week's shape from which days carried work.
 *
 * Takes **only the days that have already happened**. On a Thursday the week
 * has four days in it, not seven, and judging a four-day week against a
 * seven-day scale is how a report tells someone on Thursday morning that their
 * week is thin. Every threshold below is proportional to `active.length` for
 * that reason.
 *
 * Deliberately ignores *how much* happened on each day. A shape drawn from
 * volume is a ranking of days against each other, and one quiet day would drag
 * the whole description down — which is how a report starts commenting on the
 * person instead of the week.
 */
export function classifyShape(active: boolean[]): WeekShape {
  const total = active.length;
  const n = active.filter(Boolean).length;
  if (total === 0 || n === 0) return 'empty';
  if (n === 1) return 'single';
  // Every day so far, or all but one.
  if (n >= total - 1) return 'steady';

  // Longest consecutive run.
  let run = 0;
  let best = 0;
  for (const a of active) {
    run = a ? run + 1 : 0;
    if (run > best) best = run;
  }
  if (best >= 3 && best === n) return 'clustered';

  const half = Math.ceil(total / 2);
  const first = active.slice(0, half).filter(Boolean).length;
  const last = active.slice(total - half).filter(Boolean).length;
  if (first > last && first >= 2) return 'front_loaded';
  if (last > first && last >= 2) return 'back_loaded';
  // More than half the elapsed days.
  if (n >= Math.ceil(total * 0.55)) return 'steady';
  return 'scattered';
}

/**
 * Whether a day happened, from the union of every kind of evidence.
 *
 * The activity ledger alone is not enough and never was: before the fix in
 * focus.service.ts nothing wrote a focus session to it, so on production 31 of
 * the 48 days someone finished a session had no ledger row. Reading the ledger
 * only would have drawn two thirds of real focus days as empty bands — a report
 * telling someone nothing happened on a day they worked. The ledger stays
 * authoritative for the lifetime numeral, where it is the only source; within
 * the week the report looks at what actually exists.
 */
export function hasActivity(d: {
  ledger: boolean;
  tasks_completed: number;
  focus_minutes: number;
  focus_sessions: number;
  mood_index: number | null;
}): boolean {
  return d.ledger ||
    d.tasks_completed > 0 ||
    d.focus_sessions > 0 ||
    d.focus_minutes > 0 ||
    d.mood_index !== null;
}

/**
 * Mood lift across a week's sessions, or null when it does not point positive.
 *
 * Returning null rather than a negative number is a product decision, not a
 * missing case: the card renders only when it is good news, and a client that
 * received `-0.8` could still choose to draw it. The safest place to enforce
 * "positive only" is the place that decides the number exists.
 */
export function recoveryLift(
  pairs: Array<{ before: number | null; after: number | null }>,
): { sessions: number; before_avg: number; after_avg: number; lift: number } | null {
  const both = pairs.filter((p) => p.before != null && p.after != null) as Array<{ before: number; after: number }>;
  if (both.length === 0) return null;
  const before = both.reduce((s, p) => s + p.before, 0) / both.length;
  const after = both.reduce((s, p) => s + p.after, 0) / both.length;
  const lift = after - before;
  if (lift <= 0) return null;
  return {
    sessions: both.length,
    before_avg: Math.round(before * 100) / 100,
    after_avg: Math.round(after * 100) / 100,
    lift: Math.round(lift * 100) / 100,
  };
}

export const weeklyReportService = {
  /** GET /me/weekly-report?week_start= (any date inside the week works). */
  async get(dateStr?: string) {
    const ref = dateStr ? toUtcDate(dateStr) : toUtcDate(ymd(new Date()));
    const monday = mondayOf(ref);
    const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
    const weekStart = ymd(monday);

    const key = `weekly-report:${RequestContext.userId}:${weekStart}`;
    const cached = await cacheGet(key);
    if (cached) return JSON.parse(cached);

    const db = tenantDb();
    // Focus sessions are read from the start of Monday to the end of Sunday.
    const sundayEnd = new Date(sunday.getTime() + MS_PER_DAY - 1);
    const rhythmFrom = new Date(monday.getTime() - RHYTHM_WEEKS * 7 * MS_PER_DAY);

    const [snapshots, checkins, sessions, completedTasks, lifetime, rhythmRows] = await Promise.all([
      db.dailyActivitySnapshot.findMany({
        where: { activity_date: { gte: monday, lte: sunday } },
        select: { activity_date: true, tasks_completed: true },
      }),
      db.moodCheckin.findMany({
        where: { checkin_date: { gte: monday, lte: sunday }, checkin_type: 'morning' },
        select: { checkin_date: true, mood_score: true },
      }),
      db.focusSession.findMany({
        where: { was_completed: true, started_at: { gte: monday, lte: sundayEnd } },
        select: {
          started_at: true,
          actual_duration_mins: true,
          paused_duration_mins: true,
          course_id: true,
          prism_preset_id: true,
          mood_before: true,
          mood_after: true,
          task: { select: { title: true } },
        },
      }),
      db.task.findMany({
        where: { completed_at: { gte: monday, lte: sundayEnd } },
        select: { title: true, completed_at: true, course_id: true },
        orderBy: { completed_at: 'asc' },
      }),
      streaksService.current(),
      db.dailyActivitySnapshot.findMany({
        where: { activity_date: { gte: rhythmFrom, lt: monday } },
        select: { activity_date: true },
      }),
    ]);

    // ---- days -------------------------------------------------------------
    const ledgerDays = new Set(snapshots.map((s) => ymd(s.activity_date)));
    const moodByDay = new Map<string, number>();
    for (const c of checkins) moodByDay.set(ymd(c.checkin_date), c.mood_score - 1);

    const focusMinByDay = new Map<string, number>();
    const focusCountByDay = new Map<string, number>();
    for (const s of sessions) {
      const k = ymd(s.started_at);
      focusMinByDay.set(k, (focusMinByDay.get(k) ?? 0) + (s.actual_duration_mins ?? 0));
      focusCountByDay.set(k, (focusCountByDay.get(k) ?? 0) + 1);
    }

    const tasksByDay = new Map<string, number>();
    for (const t of completedTasks) {
      if (!t.completed_at) continue;
      const k = ymd(t.completed_at);
      tasksByDay.set(k, (tasksByDay.get(k) ?? 0) + 1);
    }

    // A day later than today has not happened yet. It is neither active nor a
    // gap, and every derived figure below excludes it: a report opened on
    // Thursday must not count Friday, Saturday and Sunday against the student.
    const todayStr = ymd(new Date());

    const days: WeeklyReportDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = ymd(new Date(monday.getTime() + i * MS_PER_DAY));
      const day = {
        date,
        weekday: i + 1,
        mood_index: moodByDay.get(date) ?? null,
        tasks_completed: tasksByDay.get(date) ?? 0,
        focus_minutes: focusMinByDay.get(date) ?? 0,
        focus_sessions: focusCountByDay.get(date) ?? 0,
      };
      days.push({
        ...day,
        is_future: date > todayStr,
        has_activity: hasActivity({ ...day, ledger: ledgerDays.has(date) }),
      });
    }

    /** The days the week actually has in it so far. */
    const elapsed = days.filter((d) => !d.is_future);

    // ---- where attention went ---------------------------------------------
    // Focus minutes are the honest unit when they exist. A student who has never
    // run a session would otherwise get an empty card, so completed tasks stand
    // in — the drawing is the same either way, and the client is told which.
    const perSubject = new Map<string, { focus_minutes: number; tasks_completed: number }>();
    const bump = (id: string | null, field: 'focus_minutes' | 'tasks_completed', by: number) => {
      const k = id ?? '';
      const cur = perSubject.get(k) ?? { focus_minutes: 0, tasks_completed: 0 };
      cur[field] += by;
      perSubject.set(k, cur);
    };
    for (const s of sessions) bump(s.course_id, 'focus_minutes', s.actual_duration_mins ?? 0);
    for (const t of completedTasks) bump(t.course_id, 'tasks_completed', 1);

    const totalFocus = [...perSubject.values()].reduce((n, v) => n + v.focus_minutes, 0);
    const totalTasks = [...perSubject.values()].reduce((n, v) => n + v.tasks_completed, 0);
    const basis: 'focus_minutes' | 'tasks_completed' = totalFocus > 0 ? 'focus_minutes' : 'tasks_completed';
    const denom = basis === 'focus_minutes' ? totalFocus : totalTasks;

    const courseIds = [...perSubject.keys()].filter((k) => k !== '');
    const courses = courseIds.length
      ? await db.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true, color: true },
      })
      : [];
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const subjects = courseIds
      .map((id) => {
        const v = perSubject.get(id)!;
        const c = courseById.get(id);
        return {
          subject_id: id,
          // A subject deleted mid-week still owns its minutes; it just has no
          // name to print, and the client draws it as an unlabelled outline.
          name: c?.name ?? null,
          color: c?.color ?? null,
          focus_minutes: v.focus_minutes,
          tasks_completed: v.tasks_completed,
          share: denom > 0 ? Math.round((v[basis] / denom) * 1000) / 1000 : 0,
        };
      })
      .filter((s) => s.focus_minutes > 0 || s.tasks_completed > 0)
      .sort((a, b) => b.share - a.share);

    const unattributed = perSubject.get('') ?? { focus_minutes: 0, tasks_completed: 0 };

    // ---- one thing that happened ------------------------------------------
    // The last completed task of the week, because a report read on Sunday
    // should reach for something the student can still remember doing.
    const last = completedTasks.length ? completedTasks[completedTasks.length - 1] : null;
    const moment = last && last.completed_at
      ? {
        kind: 'task_completed' as const,
        date: ymd(last.completed_at),
        title: last.title,
        subject_id: last.course_id,
      }
      : null;

    // ---- the rest ----------------------------------------------------------
    const recovery = recoveryLift(sessions.map((s) => ({ before: s.mood_before, after: s.mood_after })));

    const longest = sessions.reduce<typeof sessions[number] | null>(
      (best, s) => ((s.actual_duration_mins ?? 0) > (best?.actual_duration_mins ?? 0) ? s : best),
      null,
    );

    const heldMinutes = sessions.reduce((n, s) => n + (s.paused_duration_mins ?? 0), 0);

    const presetCounts = new Map<string, number>();
    for (const s of sessions) {
      if (!s.prism_preset_id) continue;
      presetCounts.set(s.prism_preset_id, (presetCounts.get(s.prism_preset_id) ?? 0) + 1);
    }
    const presets = presetCounts.size
      ? await db.prismPreset.findMany({
        where: { id: { in: [...presetCounts.keys()] } },
        select: { id: true, name: true },
      })
      : [];
    const presetTotal = [...presetCounts.values()].reduce((a, b) => a + b, 0);
    const prismMix = presets
      .map((p) => ({
        preset_id: p.id,
        name: p.name,
        sessions: presetCounts.get(p.id) ?? 0,
        share: presetTotal > 0 ? Math.round(((presetCounts.get(p.id) ?? 0) / presetTotal) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    // ---- rhythm ------------------------------------------------------------
    // Named weekdays only, never a count and never the thin ones. Weeks are
    // counted from what was observed rather than assumed, so a two-week-old
    // account is not told it has a rhythm.
    const weeksSeen = new Set<string>();
    const perWeekday = new Map<number, Set<string>>();
    for (const r of rhythmRows) {
      const d = r.activity_date;
      const wk = ymd(mondayOf(d));
      weeksSeen.add(wk);
      const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      const set = perWeekday.get(wd) ?? new Set<string>();
      set.add(wk);
      perWeekday.set(wd, set);
    }
    const rhythm = weeksSeen.size >= RHYTHM_MIN_WEEKS
      ? [...perWeekday.entries()]
        .filter(([, wks]) => wks.size / weeksSeen.size > RHYTHM_MIN_SHARE)
        .map(([wd]) => wd)
        .sort((a, b) => a - b)
      : [];

    const result = {
      week_start: weekStart,
      week_end: ymd(sunday),
      days,
      shape: classifyShape(elapsed.map((d) => d.has_activity)),
      /**
       * The hero numeral, and it is a count of *this week* — a weekly report
       * whose headline number is a lifetime total is not a weekly report, and a
       * figure above 7 in a seven-band core reads as a mistake because it is
       * one.
       */
      active_days: elapsed.filter((d) => d.has_activity).length,
      /** Days the week has had so far: 4 on a Thursday, 7 once it is over. */
      elapsed_days: elapsed.length,
      // Lifetime, from the ledger. Kept on the wire because it is the only
      // count here that cannot go down, but the report does not headline it.
      days_on_board: lifetime.total_active_days,
      subjects,
      subject_basis: basis,
      unattributed_focus_minutes: unattributed.focus_minutes,
      unattributed_tasks_completed: unattributed.tasks_completed,
      moment,
      recovery,
      longest_session: longest
        ? {
          minutes: longest.actual_duration_mins ?? 0,
          date: ymd(longest.started_at),
          task_title: longest.task?.title ?? null,
        }
        : null,
      held_minutes: heldMinutes,
      prism_mix: prismMix,
      rhythm_weekdays: rhythm,
      focus_minutes: totalFocus,
      focus_sessions: sessions.length,
      tasks_completed: totalTasks,
    };

    await cacheSet(key, JSON.stringify(result), REPORT_TTL);
    return result;
  },
};
