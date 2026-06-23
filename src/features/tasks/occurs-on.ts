/**
 * §4.2 — the recurring-task occurrence engine. PURE and dependency-free so it
 * can be unit-tested in isolation (see occurs-on.spec.ts). Never pre-expands
 * rows: callers ask "does this series occur on this date?" and materialize
 * lazily. All arithmetic is at **UTC day precision** so DST never skews counts.
 *
 * Monthly policy (decided): day-of-month **clamps to the last day of the month**
 * — a series anchored on the 31st fires on Feb 28/29, Apr 30, etc.
 */

export type RepeatKind =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'everyNDays'
  | 'everyNWeeks'
  | 'everyNMonths';

export interface SeriesLike {
  anchor_date: Date | string;
  repeat_kind: string;
  repeat_interval: number;
  until_date?: Date | string | null;
}

const MS_PER_DAY = 86_400_000;

/** Normalize any Date/`yyyy-MM-dd` string to a UTC-midnight Date (drops time/tz). */
export function toUtcDate(d: Date | string): Date {
  if (typeof d === 'string') {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** `yyyy-MM-dd` rendering of a date at UTC precision. */
export function ymd(d: Date | string): string {
  const u = toUtcDate(d);
  const mm = String(u.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(u.getUTCDate()).padStart(2, '0');
  return `${u.getUTCFullYear()}-${mm}-${dd}`;
}

/** Whole-day difference (b - a) at UTC precision. */
export function dayDiff(a: Date | string, b: Date | string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / MS_PER_DAY);
}

function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function monthDiff(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Same day-of-month as the anchor, clamped to the target month's last day. */
function matchesClampedDom(anchor: Date, day: Date): boolean {
  const effective = Math.min(anchor.getUTCDate(), daysInMonth(day));
  return day.getUTCDate() === effective;
}

/**
 * Exact §4.2 definitions:
 * - `none`        : the anchor day only
 * - `daily`       : every day ≥ anchor
 * - `weekdays`    : Mon–Fri (≥ anchor)
 * - `weekly`      : same weekday as anchor  (diff % 7 == 0)
 * - `monthly`     : same day-of-month, clamped to month end
 * - `everyNDays`  : diff % N == 0
 * - `everyNWeeks` : diff % (7·N) == 0
 * - `everyNMonths`: monthDiff % N == 0 AND same (clamped) day-of-month
 */
export function occursOn(series: SeriesLike, date: Date | string): boolean {
  const anchor = toUtcDate(series.anchor_date);
  const day = toUtcDate(date);

  if (day.getTime() < anchor.getTime()) return false;
  if (series.until_date) {
    const until = toUtcDate(series.until_date);
    if (day.getTime() > until.getTime()) return false;
  }

  const diff = dayDiff(anchor, day);
  const n = Math.max(1, Math.floor(series.repeat_interval || 1));

  switch (series.repeat_kind as RepeatKind) {
    case 'none':
      return diff === 0;
    case 'daily':
      return true; // diff >= 0 already guaranteed
    case 'weekdays': {
      const wd = day.getUTCDay(); // 0=Sun … 6=Sat
      return wd >= 1 && wd <= 5;
    }
    case 'weekly':
      return diff % 7 === 0;
    case 'monthly':
      return matchesClampedDom(anchor, day);
    case 'everyNDays':
      return diff % n === 0;
    case 'everyNWeeks':
      return diff % (7 * n) === 0;
    case 'everyNMonths':
      return monthDiff(anchor, day) % n === 0 && matchesClampedDom(anchor, day);
    default:
      return false;
  }
}

// ---- occurrence id helpers (`{series_id}@{yyyy-MM-dd}`) -------------------

export function occurrenceId(seriesId: string, date: Date | string): string {
  return `${seriesId}@${ymd(date)}`;
}

/** Split `{series_id}@{yyyy-MM-dd}`; tolerant of `@` appearing nowhere else. */
export function parseOccurrenceId(occId: string): { seriesId: string; date: string } | null {
  const at = occId.lastIndexOf('@');
  if (at <= 0 || at === occId.length - 1) return null;
  const date = occId.slice(at + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { seriesId: occId.slice(0, at), date };
}
