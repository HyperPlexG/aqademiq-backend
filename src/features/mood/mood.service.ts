import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { RevisionService } from '../../infra/revision.service';
import { RequestContext } from '../../common/request-context';
import { toUtcDate, ymd } from '../tasks/occurs-on';
import { LogMoodDto, ReflectionDto } from './dto/mood.dto';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class MoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  /** POST /mood-entries — morning check-in; preserves any existing reflection. */
  async log(dto: LogMoodDto) {
    const date = toUtcDate(dto.date);
    const score = dto.mood_index + 1;
    const existing = await this.prisma.tenant.moodCheckin.findFirst({
      where: { checkin_type: 'morning', checkin_date: date },
    });
    let entry;
    if (existing) {
      entry = await this.prisma.moodCheckin.update({
        where: { id: existing.id },
        data: { mood_score: score, note: dto.intention ?? null },
      });
    } else {
      entry = await this.prisma.moodCheckin.create({
        data: {
          user_id: this.rc.userId,
          checkin_type: 'morning',
          mood_score: score,
          note: dto.intention ?? null,
          checkin_date: date,
        },
      });
    }
    await this.appendActivity(dto.date, date);
    return this.dto(entry, 'morning');
  }

  /** POST /mood-entries/:date/reflection — evening reflection; preserves mood. */
  async reflect(dateStr: string, dto: ReflectionDto) {
    const date = toUtcDate(dateStr);
    const existing = await this.prisma.tenant.moodCheckin.findFirst({
      where: { checkin_type: 'evening', checkin_date: date },
    });
    let entry;
    if (existing) {
      entry = await this.prisma.moodCheckin.update({
        where: { id: existing.id },
        data: { note: dto.reflection },
      });
    } else {
      entry = await this.prisma.moodCheckin.create({
        data: {
          user_id: this.rc.userId,
          checkin_type: 'evening',
          mood_score: 3, // neutral
          note: dto.reflection,
          checkin_date: date,
        },
      });
    }
    await this.appendActivity(dateStr, date);
    return this.dto(entry, 'evening');
  }

  /** GET /mood-entries/:date */
  async getDay(dateStr: string) {
    const date = toUtcDate(dateStr);
    const checkins = await this.prisma.tenant.moodCheckin.findMany({
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
  }

  /** GET /mood-entries/week?date= */
  async week(dateStr?: string) {
    const ref = toUtcDate(dateStr ?? ymd(new Date()));
    const dow = ref.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref.getTime() + mondayOffset * MS_PER_DAY);
    const dates = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * MS_PER_DAY));

    const checkins = await this.prisma.tenant.moodCheckin.findMany({
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
  }

  /** GET /mood-entries/today?field= */
  async today(field?: string) {
    const date = toUtcDate(ymd(new Date()));
    const checkins = await this.prisma.tenant.moodCheckin.findMany({
      where: { checkin_date: date },
    });
    const moodLogged = checkins.some((c) => c.checkin_type === 'morning');
    const reflectionLogged = checkins.some((c) => c.checkin_type === 'evening' && c.note);
    if (field === 'mood') return { today_mood_logged: moodLogged };
    if (field === 'reflection') return { today_reflection_logged: reflectionLogged };
    return { today_mood_logged: moodLogged, today_reflection_logged: reflectionLogged };
  }

  // ---- internals ---------------------------------------------------------

  private async appendActivity(refId: string, eventDate: Date) {
    await this.prisma.dailyActivitySnapshot.upsert({
      where: { user_id_activity_date: { user_id: this.rc.userId, activity_date: eventDate } },
      create: { user_id: this.rc.userId, activity_date: eventDate },
      update: {},
    });
    await this.redis.client.del(`streaks:current:${this.rc.userId}`);
    await this.rev.bump(this.rc.userId, 'mood');
  }

  private dto(e: any, type: 'morning' | 'evening') {
    return {
      date: ymd(e.checkin_date),
      mood_index: type === 'morning' ? e.mood_score - 1 : null,
      intention: type === 'morning' ? e.note : null,
      reflection: type === 'evening' ? e.note : null,
    };
  }
}
