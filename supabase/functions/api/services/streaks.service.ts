// §2.6/§4.7 — streaks + activity dates. Port of src/features/streaks/streaks.service.ts.
import { tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { cacheGet, cacheSet } from '../../_shared/redis.ts';
import { toUtcDate, ymd } from '../../_shared/occurs-on.ts';

const MS_PER_DAY = 86_400_000;
const STREAK_TTL = 60;

async function activeDateSet(): Promise<Set<string>> {
  const snapshots = await tenantDb().dailyActivitySnapshot.findMany({ select: { activity_date: true } });
  return new Set(snapshots.map((s) => ymd(s.activity_date)));
}

/** Consecutive run ending today, or yesterday if today is empty. */
function computeStreak(dates: Set<string>, todayStr: string): number {
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

export const streaksService = {
  async current() {
    const key = `streaks:current:${RequestContext.userId}`;
    const cached = await cacheGet(key);
    if (cached) return JSON.parse(cached);

    const dates = await activeDateSet();
    const todayStr = ymd(new Date());
    const result = {
      current_streak: computeStreak(dates, todayStr),
      today_has_activity: dates.has(todayStr),
      total_active_days: dates.size,
    };
    await cacheSet(key, JSON.stringify(result), STREAK_TTL);
    return result;
  },

  async activityDates() {
    const dates = [...(await activeDateSet())].sort();
    return { dates };
  },

  async weekCount(dateStr?: string) {
    const ref = toUtcDate(dateStr ?? ymd(new Date()));
    const dow = ref.getUTCDay();
    const monday = new Date(ref.getTime() + (dow === 0 ? -6 : 1 - dow) * MS_PER_DAY);
    const dates = await activeDateSet();
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (dates.has(ymd(new Date(monday.getTime() + i * MS_PER_DAY)))) count++;
    }
    return { week_start: ymd(monday), count };
  },

  async todayHasActivity() {
    const dates = await activeDateSet();
    return { today_has_activity: dates.has(ymd(new Date())) };
  },
};
