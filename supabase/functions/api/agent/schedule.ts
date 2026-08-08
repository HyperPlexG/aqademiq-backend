// Ada agent — what time is actually occupied.
//
// Ada could schedule anything anywhere: nothing in the codebase checked whether
// a proposed slot was already taken, so it would happily book study time on top
// of a lecture. Calendar import (ICS + Google) has existed in
// integrations.service.ts the whole time and the agent had no way to read what
// it imported.
//
// The one genuinely fiddly thing here is that the two sources measure time
// differently:
//
//   tasks           store wall clock AS IF it were UTC. `create_task` writes
//                   `${date}T${HH:MM}:00.000Z` deliberately, so a task at 09:00
//                   is 09:00 on the user's wall regardless of timezone.
//   calendar_events store real instants (from ICS/Google), so a 09:00 lecture in
//                   Asia/Kolkata is 03:30Z.
//
// Comparing them naively puts every imported event 5.5 hours out of place. So
// everything is normalised to the user's LOCAL wall clock — minutes since
// midnight on a given day — before any overlap arithmetic happens.

import { tenantDb } from '../../_shared/prisma.ts';
import { tasksService } from '../services/tasks.service.ts';
import { hhmmInTz, ymdInTz } from './context.ts';

/** Default waking window used when the caller doesn't specify one. */
export const DEFAULT_DAY_START = '08:00';
export const DEFAULT_DAY_END = '22:00';
/** A gap shorter than this isn't a study slot, it's the walk between rooms. */
export const DEFAULT_MIN_SLOT_MINUTES = 25;
/** Guards the fan-out of a free/busy question over a silly range. */
export const MAX_RANGE_DAYS = 31;

export interface BusyBlock {
  date: string;
  /** HH:MM local. */
  start: string;
  end: string;
  title: string;
  source: 'task' | 'calendar';
  /** Present for tasks, so a conflict check can ignore the task being edited. */
  task_id?: string;
}

export interface FreeSlot {
  date: string;
  start: string;
  end: string;
  minutes: number;
}

// ---- wall-clock helpers (minutes since local midnight) --------------------

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHhmm(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86_400_000) + 1;
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = 0, d = from; i < dayCount(from, to); i++, d = addDays(d, 1)) out.push(d);
  return out;
}

// ---- busy ----------------------------------------------------------------

/**
 * Everything occupying wall-clock time between `from` and `to` inclusive.
 *
 * Tasks come via tasksService.query rather than a direct table read so that
 * recurrence expansion — the `occursOn` engine and its virtual occurrences — is
 * inherited rather than reimplemented. A weekly lecture booked as a repeating
 * task therefore blocks every one of its occurrences, not just the first.
 *
 * Untimed ("anytime") tasks are excluded on purpose: they are a to-do list, not
 * a commitment to a slot, and treating them as busy would leave a heavy user
 * with no free time at all.
 */
export async function busyBlocks(from: string, to: string, timezone: string): Promise<BusyBlock[]> {
  const [taskRes, events] = await Promise.all([
    tasksService.query({ from, to }).catch(() => ({ tasks: [] })),
    tenantDb().calendarEvent.findMany({
      where: {
        starts_at: {
          // Widened by a day either side: an event's LOCAL day can differ from
          // its UTC day by up to a timezone offset, and a lecture that is
          // Monday 09:00 in Kolkata starts Sunday 03:30Z.
          gte: new Date(`${addDays(from, -1)}T00:00:00.000Z`),
          lte: new Date(`${addDays(to, 1)}T23:59:59.999Z`),
        },
      },
      orderBy: { starts_at: 'asc' },
    }).catch(() => []),
  ]);

  const blocks: BusyBlock[] = [];

  // deno-lint-ignore no-explicit-any
  for (const t of (taskRes.tasks as any[])) {
    if (!t.scheduled_at) continue; // untimed — see above
    const [date, time] = String(t.scheduled_at).split('T');
    if (!date || !time) continue;
    const startMin = toMinutes(time.slice(0, 5));
    const minutes = Math.max(5, Math.round((t.duration_seconds ?? 300) / 60));
    blocks.push({
      date,
      start: toHhmm(startMin),
      end: toHhmm(startMin + minutes),
      title: t.title,
      source: 'task',
      task_id: t.id,
    });
  }

  // deno-lint-ignore no-explicit-any
  for (const e of (events as any[])) {
    const startsAt = new Date(e.starts_at);
    const date = ymdInTz(startsAt, timezone);
    if (date < from || date > to) continue; // trimmed back after the widened fetch
    if (e.is_all_day) {
      // An all-day event says something about the day, not about a slot. Marking
      // it 00:00–23:59 busy would wipe out the entire day's free time.
      continue;
    }
    const startMin = toMinutes(hhmmInTz(startsAt, timezone));
    const endsAt = e.ends_at ? new Date(e.ends_at) : null;
    // A same-day end is read on the local clock; one that crosses midnight is
    // clamped to end-of-day rather than wrapping to a negative span.
    let endMin = startMin + 60;
    if (endsAt) {
      const endDate = ymdInTz(endsAt, timezone);
      endMin = endDate === date ? toMinutes(hhmmInTz(endsAt, timezone)) : 24 * 60;
    }
    if (endMin <= startMin) endMin = startMin + 30;
    blocks.push({
      date,
      start: toHhmm(startMin),
      end: toHhmm(endMin),
      title: e.title,
      source: 'calendar',
    });
  }

  blocks.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
  return blocks;
}

// ---- free ----------------------------------------------------------------

export interface FreeSlotOptions {
  minMinutes?: number;
  dayStart?: string;
  dayEnd?: string;
}

/**
 * The gaps left in the waking window once everything busy is removed.
 *
 * Overlapping commitments are merged before subtraction, so a lecture that
 * overlaps a study block does not carve the day into a phantom sliver between
 * them.
 */
export async function freeSlots(
  from: string,
  to: string,
  timezone: string,
  opts: FreeSlotOptions = {},
): Promise<FreeSlot[]> {
  return computeFreeSlots(await busyBlocks(from, to, timezone), eachDay(from, to), opts);
}

/**
 * The pure half of free/busy: given what's busy, what's left.
 *
 * Split out from `freeSlots` so the arithmetic — interval merging and gap
 * subtraction — can be tested without a database. This is the part where a
 * subtle bug is dangerous rather than merely wrong: it would hand Ada a slot
 * that is not actually free, and Ada would schedule into it.
 */
export function computeFreeSlots(
  blocks: BusyBlock[],
  days: string[],
  opts: FreeSlotOptions = {},
): FreeSlot[] {
  const minMinutes = opts.minMinutes ?? DEFAULT_MIN_SLOT_MINUTES;
  const dayStart = toMinutes(opts.dayStart ?? DEFAULT_DAY_START);
  const dayEnd = toMinutes(opts.dayEnd ?? DEFAULT_DAY_END);

  const byDate = new Map<string, Array<[number, number]>>();
  for (const b of blocks) {
    const list = byDate.get(b.date) ?? [];
    list.push([toMinutes(b.start), toMinutes(b.end)]);
    byDate.set(b.date, list);
  }

  const out: FreeSlot[] = [];
  for (const date of days) {
    const merged: Array<[number, number]> = [];
    for (const span of (byDate.get(date) ?? []).sort((a, b) => a[0] - b[0])) {
      const last = merged[merged.length - 1];
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else merged.push([span[0], span[1]]);
    }

    let cursor = dayStart;
    for (const [start, end] of merged) {
      if (start > cursor) {
        const gapEnd = Math.min(start, dayEnd);
        if (gapEnd - cursor >= minMinutes) {
          out.push({ date, start: toHhmm(cursor), end: toHhmm(gapEnd), minutes: gapEnd - cursor });
        }
      }
      cursor = Math.max(cursor, end);
      if (cursor >= dayEnd) break;
    }
    if (cursor < dayEnd && dayEnd - cursor >= minMinutes) {
      out.push({ date, start: toHhmm(cursor), end: toHhmm(dayEnd), minutes: dayEnd - cursor });
    }
  }

  return out;
}

// ---- conflicts -----------------------------------------------------------

/**
 * What a proposed slot would collide with.
 *
 * Used by the create/update previews so the confirmation card can warn BEFORE
 * the user approves — the point being that a double-booking is caught while it
 * is still a proposal, not discovered afterwards.
 */
export async function conflictsFor(
  date: string,
  startHhmm: string,
  durationMinutes: number,
  timezone: string,
  ignoreTaskId?: string,
): Promise<BusyBlock[]> {
  const blocks = await busyBlocks(date, date, timezone);
  const start = toMinutes(startHhmm);
  const end = start + Math.max(5, durationMinutes);

  return blocks.filter((b) => {
    if (b.date !== date) return false;
    // Editing a task must not report the task colliding with itself. Occurrence
    // ids carry an `@date` suffix, so compare on the series id.
    if (ignoreTaskId && b.task_id && b.task_id.split('@')[0] === ignoreTaskId.split('@')[0]) return false;
    return toMinutes(b.start) < end && toMinutes(b.end) > start;
  });
}

/** One-line description of a clash, for a confirmation card's warning. */
export function describeConflicts(conflicts: BusyBlock[]): string | undefined {
  if (conflicts.length === 0) return undefined;
  const first = conflicts[0];
  const rest = conflicts.length - 1;
  const tail = rest > 0 ? ` (and ${rest} other${rest === 1 ? '' : 's'})` : '';
  return `This overlaps “${first.title}” at ${first.start}–${first.end}${tail}.`;
}
