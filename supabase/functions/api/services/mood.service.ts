// §2.7 — mood check-ins (morning/evening) + weekly view. Port of src/features/mood/mood.service.ts.
// Wire mapping: mood_index (0–4 on wire) ↔ mood_score (1–5 stored). Preserved exactly.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { cacheDel } from '../../_shared/redis.ts';
import { revision } from '../../_shared/revision.ts';
import { HttpError } from '../../_shared/http.ts';
import { toUtcDate, ymd } from '../../_shared/occurs-on.ts';

const MS_PER_DAY = 86_400_000;

export interface LogMoodDto {
  date: string;
  mood_index: number;
  intention?: string;
}

export interface ReflectionDto {
  reflection: string;
}

/**
 * Refuse a check-in dated after today.
 *
 * The mood strip on the Stats tab offered every weekday as a tappable slot,
 * so on a Thursday you could log how Saturday went. That is not a harmless
 * spare feature: the weekly report draws its bands from these rows, so a mood
 * logged into the future puts a tinted band on a day that has not happened,
 * and the check-in the student actually makes on Saturday then silently
 * overwrites a record they no longer remember creating.
 *
 * Enforced here rather than only in the UI because the UI is one of several
 * ways in — Ada has mood tools, and a client can always be older than the
 * server.
 */
function assertNotFuture(date: Date): void {
  if (ymd(date) > ymd(new Date())) {
    throw new HttpError(422, 'That day has not happened yet');
  }
}

export const moodService = {
  /** POST /mood-entries — morning check-in; preserves any existing reflection. */
  async log(dto: LogMoodDto) {
    const date = toUtcDate(dto.date);
    assertNotFuture(date);
    const score = dto.mood_index + 1;
    const existing = await tenantDb().moodCheckin.findFirst({
      where: { checkin_type: 'morning', checkin_date: date },
    });
    let entry;
    if (existing) {
      entry = await prismaBase().moodCheckin.update({
        where: { id: existing.id },
        data: { mood_score: score, note: dto.intention ?? null },
      });
    } else {
      entry = await prismaBase().moodCheckin.create({
        data: {
          user_id: RequestContext.userId,
          checkin_type: 'morning',
          mood_score: score,
          note: dto.intention ?? null,
          checkin_date: date,
        },
      });
    }
    await this.appendActivity(dto.date, date);
    return this.dto(entry, 'morning');
  },

  /** POST /mood-entries/:date/reflection — evening reflection; preserves mood. */
  async reflect(dateStr: string, dto: ReflectionDto) {
    const date = toUtcDate(dateStr);
    assertNotFuture(date);
    const existing = await tenantDb().moodCheckin.findFirst({
      where: { checkin_type: 'evening', checkin_date: date },
    });
    let entry;
    if (existing) {
      entry = await prismaBase().moodCheckin.update({
        where: { id: existing.id },
        data: { note: dto.reflection },
      });
    } else {
      entry = await prismaBase().moodCheckin.create({
        data: {
          user_id: RequestContext.userId,
          checkin_type: 'evening',
          mood_score: 3, // neutral
          note: dto.reflection,
          checkin_date: date,
        },
      });
    }
    await this.appendActivity(dateStr, date);
    return this.dto(entry, 'evening');
  },

  /** GET /mood-entries/:date */
  async getDay(dateStr: string) {
    const date = toUtcDate(dateStr);
    const checkins = await tenantDb().moodCheckin.findMany({
      where: { checkin_date: date },
    });
    const morning = checkins.find((c) => c.checkin_type === 'morning');
    const evening = checkins.find((c) => c.checkin_type === 'evening');
    return {
      date: dateStr,
      mood_index: morning ? morning.mood_score - 1 : null,
      intention: morning ? morning.note : null,
      reflection: evening ? evening.note : null,
    };
  },

  /** GET /mood-entries/week?date= */
  async week(dateStr?: string) {
    const ref = toUtcDate(dateStr ?? ymd(new Date()));
    const dow = ref.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref.getTime() + mondayOffset * MS_PER_DAY);
    const dates = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * MS_PER_DAY));

    const checkins = await tenantDb().moodCheckin.findMany({
      where: { checkin_date: { gte: dates[0], lte: dates[6] } },
    });
    const byDate = new Map<string, typeof checkins>();
    for (const c of checkins) {
      const k = ymd(c.checkin_date);
      const arr = byDate.get(k) ?? [];
      arr.push(c);
      byDate.set(k, arr);
    }
    const days = dates.map((d) => {
      const k = ymd(d);
      const arr = byDate.get(k) ?? [];
      const morning = arr.find((c) => c.checkin_type === 'morning');
      const evening = arr.find((c) => c.checkin_type === 'evening');
      return {
        date: k,
        mood_index: morning ? morning.mood_score - 1 : null,
        intention: morning ? morning.note : null,
        reflection: evening ? evening.note : null,
      };
    });
    return { week_start: ymd(monday), days };
  },

  /** GET /mood-entries/today?field= */
  async today(field?: string) {
    const date = toUtcDate(ymd(new Date()));
    const checkins = await tenantDb().moodCheckin.findMany({
      where: { checkin_date: date },
    });
    const moodLogged = checkins.some((c) => c.checkin_type === 'morning');
    const reflectionLogged = checkins.some((c) => c.checkin_type === 'evening' && c.note);
    if (field === 'mood') return { today_mood_logged: moodLogged };
    if (field === 'reflection') return { today_reflection_logged: reflectionLogged };
    return { today_mood_logged: moodLogged, today_reflection_logged: reflectionLogged };
  },

  // ---- internals ---------------------------------------------------------

  async appendActivity(_refId: string, eventDate: Date) {
    await prismaBase().dailyActivitySnapshot.upsert({
      where: { user_id_activity_date: { user_id: RequestContext.userId, activity_date: eventDate } },
      create: { user_id: RequestContext.userId, activity_date: eventDate },
      update: {},
    });
    await cacheDel(`streaks:current:${RequestContext.userId}`);
    await revision.bump(RequestContext.userId, 'mood');
  },

  // deno-lint-ignore no-explicit-any
  dto(e: any, type: 'morning' | 'evening') {
    return {
      date: ymd(e.checkin_date),
      mood_index: type === 'morning' ? e.mood_score - 1 : null,
      intention: type === 'morning' ? e.note : null,
      reflection: type === 'evening' ? e.note : null,
    };
  },
};
