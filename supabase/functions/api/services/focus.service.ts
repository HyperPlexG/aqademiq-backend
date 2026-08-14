// §2.4 — focus sessions (start / checkpoint / complete). Port of src/features/focus/focus.service.ts.
//
// This service is what the Prism analytics read, and for a long time it wrote
// almost none of what they need. Measured on production over 84 rows /
// 47 completed: `ended_at` set on 0, `course_id` set on 0, no row with a
// non-zero `paused_duration_mins` or `interruption_count`, and 40 of 47
// completed sessions recording 0 minutes.
//
// The columns all existed. `complete()` simply never wrote an end time, `start()`
// never copied the subject off the task, and the PAUSED/RUNNING checkpoints the
// app already sends were used only to set a status string. So the fixes below
// are about *recording what already happens* rather than asking the client for
// anything new — the one exception being the optional ratings, which nothing
// collects yet.
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { prismService } from './prism.service.ts';
import { tasksService } from './tasks.service.ts';
import { isPrismHeldOut } from './experiments.service.ts';

// DB constraint focus_sessions_status_check + focus_sessions_mood_*_check.
// Wire status is UPPERCASE (RUNNING/PAUSED/COMPLETE); stored is lowercase and the
// completed value is 'completed' (not 'complete'). Wire mood_index is 0–4; the
// stored mood_after/mood_before columns are 1–5 (like mood_checkins).
const FOCUS_STATUSES = new Set(['planned', 'running', 'paused', 'completed', 'cancelled']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normFocusStatus(wire?: string): string | undefined {
  if (!wire) return undefined;
  let s = wire.toLowerCase();
  if (s === 'complete') s = 'completed';
  return FOCUS_STATUSES.has(s) ? s : undefined;
}
function moodIndexToScore(idx: number): number {
  return Math.min(5, Math.max(1, Math.round(idx) + 1));
}

/**
 * `focus_sessions.task_id` is a real FK, but the app's task ids are *occurrence*
 * ids — `<uuid>@<YYYY-MM-DD>` for anything repeating. Passing one straight
 * through fails the constraint, which is why a session started from a repeating
 * task never linked. Only the series id can be stored.
 */
export function seriesIdOf(taskId?: string | null): string | null {
  if (!taskId) return null;
  const id = taskId.split('@')[0];
  return UUID_RE.test(id) ? id : null;
}

/** When a pause is open, `metadata.paused_at` holds the instant it began. */
function pausedAtOf(metadata: unknown): Date | null {
  const raw = (metadata as { paused_at?: unknown } | null)?.paused_at;
  if (typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Close an open pause at `now`, returning the minutes it lasted and the
 * metadata with the marker removed.
 *
 * Wall clock is the only honest source here: the client's elapsed counter stops
 * while paused, so it cannot say how long the pause was.
 */
export function closePause(metadata: unknown, now: Date): { minutes: number; metadata: Record<string, unknown> } {
  const rest = { ...(metadata as Record<string, unknown> ?? {}) };
  delete rest.paused_at;
  const startedPause = pausedAtOf(metadata);
  if (!startedPause) return { minutes: 0, metadata: rest };
  const mins = Math.round((now.getTime() - startedPause.getTime()) / 60_000);
  return { minutes: Math.max(0, mins), metadata: rest };
}

/**
 * Minutes actually studied.
 *
 * Prefers the client's elapsed seconds — it excludes paused time by
 * construction — and falls back to the wall clock minus pauses so a session
 * whose client died still records something truthful instead of nothing.
 *
 * Rounds rather than flooring: the old `Math.floor(sec / 60)` recorded a
 * 24m50s session as 24 minutes, and anything under a minute as 0.
 */
export function studiedMinutes(
  elapsedSec: number | undefined,
  startedAt: Date,
  endedAt: Date,
  pausedMins: number,
): number {
  if (elapsedSec !== undefined && elapsedSec > 0) return Math.round(elapsedSec / 60);
  const wallMins = (endedAt.getTime() - startedAt.getTime()) / 60_000;
  return Math.max(0, Math.round(wallMins - pausedMins));
}

export interface StartFocusDto {
  planned_min?: number;
  prism_mode?: string;
  task_id?: string;
  task_date?: string;
  /** Optional 0–4 wire index, stored 1–5. */
  mood_index?: number;
  /**
   * Prism engine build that ran this session.
   *
   * `control_arm` is deliberately NOT here: it is assigned server-side from the
   * user's permanent experiment variant. A client that could set it could opt
   * itself out of the holdout, which is the exact selection bias §4.3 exists to
   * avoid.
   */
  engine_version?: string;
}

export interface CheckpointFocusDto {
  elapsed_sec?: number;
  status?: string;
}

export interface CompleteFocusDto {
  elapsed_sec?: number;
  mood_index?: number;
  /** Optional 1–5. */
  session_rating?: number;
}

// deno-lint-ignore no-explicit-any
function dto(s: any) {
  return {
    id: s.id,
    planned_min: s.planned_duration_mins,
    elapsed_sec: s.actual_duration_mins ? s.actual_duration_mins * 60 : 0,
    status: (s.status ?? '').toUpperCase(),
    prism_mode: s.prism_preset_id ? 'Preset' : null,
    task_id: s.task_id,
    task_date: null,
    mood_index: s.mood_after != null ? s.mood_after - 1 : null,
    // Surfaced so the client (and anyone debugging the analytics) can see that
    // these are now actually being recorded.
    ended_at: s.ended_at ?? null,
    actual_duration_mins: s.actual_duration_mins ?? null,
    paused_duration_mins: s.paused_duration_mins ?? 0,
    interruption_count: s.interruption_count ?? 0,
    course_id: s.course_id ?? null,
    session_rating: s.session_rating ?? null,
    // The client reads this to honour the holdout: when true it must not start
    // the soundscape. Told rather than asked, so the arm cannot be self-selected.
    control_arm: s.control_arm ?? false,
    engine_version: s.engine_version ?? null,
    created_at: s.created_at,
  };
}

async function owned(id: string) {
  const s = await prismaBase().focusSession.findFirst({ where: { id, user_id: RequestContext.userId } });
  if (!s) throw new HttpError(404, 'Focus session not found');
  return s;
}

export const focusService = {
  async start(input: StartFocusDto) {
    // Accepts either a mode key ('rain') or a preset id; 'none'/unknown → null.
    const presetId = await prismService.resolvePresetId(input.prism_mode);
    const taskId = seriesIdOf(input.task_id);

    // course_id was set on zero rows because nothing ever derived it. It lives
    // on the task the session was started from, and is copied at start rather
    // than read at query time so that editing or deleting the task later cannot
    // rewrite history the analytics already counted.
    let courseId: string | null = null;
    if (taskId) {
      const task = await prismaBase().task.findFirst({
        where: { id: taskId, user_id: RequestContext.userId },
        select: { course_id: true },
      });
      courseId = task?.course_id ?? null;
    }

    const session = await prismaBase().focusSession.create({
      data: {
        user_id: RequestContext.userId,
        planned_duration_mins: input.planned_min ?? 25,
        prism_preset_id: presetId,
        task_id: taskId,
        course_id: courseId,
        status: 'running',
        // Server-assigned and permanent per user (experiments.service.ts).
        // Denormalised onto the session so the analytics can read the arm
        // without a join, and so a later change to the experiment cannot
        // retroactively relabel sessions that already happened.
        control_arm: await isPrismHeldOut(RequestContext.userId),
        engine_version: input.engine_version ?? null,
        ...(input.mood_index !== undefined ? { mood_before: moodIndexToScore(input.mood_index) } : {}),
      },
    });
    return dto(session);
  },

  async checkpoint(id: string, input: CheckpointFocusDto) {
    const existing = await owned(id);
    const status = normFocusStatus(input.status);
    const now = new Date();

    // deno-lint-ignore no-explicit-any
    const data: Record<string, any> = {};
    if (input.elapsed_sec !== undefined) {
      data.actual_duration_mins = Math.round(input.elapsed_sec / 60);
    }
    if (status !== undefined) data.status = status;

    // The app already sends a checkpoint on every pause and resume. Those two
    // transitions are all that is needed to fill interruption_count and
    // paused_duration_mins, which is why neither needs a client change.
    const wasPaused = existing.status === 'paused';
    if (status === 'paused' && !wasPaused) {
      data.interruption_count = { increment: 1 };
      data.metadata = { ...(existing.metadata as Record<string, unknown> ?? {}), paused_at: now.toISOString() };
    } else if (status === 'running' && wasPaused) {
      const closed = closePause(existing.metadata, now);
      if (closed.minutes > 0) data.paused_duration_mins = { increment: closed.minutes };
      data.metadata = closed.metadata;
    }

    const session = await prismaBase().focusSession.update({ where: { id }, data });
    return dto(session);
  },

  /** POST /:id/complete */
  async complete(id: string, input: CompleteFocusDto) {
    const existing = await owned(id);

    // complete() is called twice by design: once when the timer stops, and
    // again when the summary screen submits mood and rating. The FIRST call is
    // the real end of the session, so the timing fields are pinned to it —
    // otherwise ended_at would drift to whenever the user got round to
    // dismissing the summary, and every duration derived from it would inherit
    // that lag.
    const endedAt = existing.ended_at ?? new Date();

    // Completing straight from a paused timer leaves a pause still open; close
    // it here or that time is silently dropped from the total.
    const closed = closePause(existing.metadata, endedAt);
    const pausedMins = (existing.paused_duration_mins ?? 0) + closed.minutes;

    const session = await prismaBase().focusSession.update({
      where: { id },
      data: {
        status: 'completed',
        was_completed: true,
        // Never written before this — 0 of 84 rows had it, which is what made
        // every "when did this session actually end" analytic impossible.
        ended_at: endedAt,
        actual_duration_mins: studiedMinutes(input.elapsed_sec, existing.started_at, endedAt, pausedMins),
        paused_duration_mins: pausedMins,
        // deno-lint-ignore no-explicit-any
        metadata: closed.metadata as any,
        ...(input.mood_index !== undefined ? { mood_after: moodIndexToScore(input.mood_index) } : {}),
        ...(input.session_rating !== undefined ? { session_rating: input.session_rating } : {}),
      },
    });

    let linkedTask = null;
    if (existing.task_id) {
      try {
        linkedTask = await tasksService.setDone(existing.task_id, true);
      } catch {
        // ignore errors
      }
    }
    return { ...dto(session), linked_task: linkedTask };
  },
};
