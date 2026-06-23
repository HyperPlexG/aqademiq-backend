import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { RequestContext } from '../../common/request-context';
import { toUtcDate, ymd } from '../tasks/occurs-on';

const MS_PER_DAY = 86_400_000;
const STREAK_TTL = 60;

/**
 * §2.6/§4.7 — server-authoritative streaks. Computed from the append-only
 * ActivityEvent ledger (union of task_completion + mood_log days); the client
 * streak is never trusted. Streak = longest consecutive run of distinct
 * event_dates ending today (or yesterday if today is empty). Redis-cached.
 *
 * TODO(§4.7): nightly BullMQ recompute per tz bucket for at-risk nudges.
 */
@Injectable()
export class StreaksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rc: RequestContext,
  ) {}

  async current() {
    const key = `streaks:current:${this.rc.userId}`;
    const cached = await this.redis.client.get(key);
    if (cached) return JSON.parse(cached);

    const dates = await this.activeDateSet();
    const todayStr = ymd(new Date());
    const result = {
      current_streak: this.computeStreak(dates, todayStr),
      today_has_activity: dates.has(todayStr),
      total_active_days: dates.size,
    };
    await this.redis.client.set(key, JSON.stringify(result), 'EX', STREAK_TTL);
    return result;
  }

  /** GET /activity-dates — sorted union of all active days. */
  async activityDates() {
    const dates = [...(await this.activeDateSet())].sort();
    return { dates };
  }

  /** GET /week-count — active-day count within the ISO week of `date`. */
  async weekCount(dateStr?: string) {
    const ref = toUtcDate(dateStr ?? ymd(new Date()));
    const dow = ref.getUTCDay();
    const monday = new Date(ref.getTime() + (dow === 0 ? -6 : 1 - dow) * MS_PER_DAY);
    const dates = await this.activeDateSet();
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (dates.has(ymd(new Date(monday.getTime() + i * MS_PER_DAY)))) count++;
    }
    return { week_start: ymd(monday), count };
  }

  /** GET /today-has-activity */
  async todayHasActivity() {
    const dates = await this.activeDateSet();
    return { today_has_activity: dates.has(ymd(new Date())) };
  }

  // ---- internals ---------------------------------------------------------

  private async activeDateSet(): Promise<Set<string>> {
    const events = await this.prisma.tenant.activityEvent.findMany({ select: { event_date: true } });
    return new Set(events.map((e) => ymd(e.event_date)));
  }

  /** Consecutive run ending today, or yesterday if today is empty. */
  private computeStreak(dates: Set<string>, todayStr: string): number {
    const today = toUtcDate(todayStr);
    let cursor: Date;
    if (dates.has(todayStr)) {
      cursor = today;
    } else {
      const yesterday = new Date(today.getTime() - MS_PER_DAY);
      if (!dates.has(ymd(yesterday))) return 0;
      cursor = yesterday;
    }
    let streak = 0;
    while (dates.has(ymd(cursor))) {
      streak++;
      cursor = new Date(cursor.getTime() - MS_PER_DAY);
    }
    return streak;
  }
}
