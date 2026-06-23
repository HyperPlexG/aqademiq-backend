import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { RevisionService } from '../../infra/revision.service';
import { RequestContext } from '../../common/request-context';
import { toUtcDate, ymd } from '../tasks/occurs-on';
import { LogMoodDto, ReflectionDto } from './dto/mood.dto';

const MS_PER_DAY = 86_400_000;

/**
 * §2.7 — mood & reflections with **asymmetric upsert merge**:
 *  - mood log overwrites mood_index + intention, PRESERVES existing reflection
 *  - reflection log overwrites reflection, PRESERVES existing mood/intention
 * Each write also appends an idempotent ActivityEvent (source=mood_log) so the
 * day counts toward the streak (§4.7). MoodEntry is keyed UNIQUE(user_id, date).
 */
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
    const entry = await this.prisma.moodEntry.upsert({
      where: { user_id_date: { user_id: this.rc.userId, date } },
      create: { user_id: this.rc.userId, date, mood_index: dto.mood_index, intention: dto.intention ?? null },
      update: { mood_index: dto.mood_index, intention: dto.intention ?? null },
    });
    await this.appendActivity(dto.date, date);
    return this.dto(entry);
  }

  /** POST /mood-entries/:date/reflection — evening reflection; preserves mood. */
  async reflect(dateStr: string, dto: ReflectionDto) {
    const date = toUtcDate(dateStr);
    const entry = await this.prisma.moodEntry.upsert({
      where: { user_id_date: { user_id: this.rc.userId, date } },
      create: { user_id: this.rc.userId, date, reflection: dto.reflection },
      update: { reflection: dto.reflection },
    });
    await this.appendActivity(dateStr, date);
    return this.dto(entry);
  }

  /** GET /mood-entries/:date */
  async getDay(dateStr: string) {
    const date = toUtcDate(dateStr);
    const entry = await this.prisma.moodEntry.findUnique({
      where: { user_id_date: { user_id: this.rc.userId, date } },
    });
    return entry ? this.dto(entry) : { date: dateStr, mood_index: null, intention: null, reflection: null };
  }

  /** GET /mood-entries/week?date= — ISO-week Monday-start, 7 slots (index 0 = Mon). */
  async week(dateStr?: string) {
    const ref = toUtcDate(dateStr ?? ymd(new Date()));
    const dow = ref.getUTCDay(); // 0=Sun … 6=Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref.getTime() + mondayOffset * MS_PER_DAY);
    const dates = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * MS_PER_DAY));

    const entries = await this.prisma.moodEntry.findMany({
      where: { user_id: this.rc.userId, date: { gte: dates[0], lte: dates[6] } },
    });
    const byDate = new Map(entries.map((e) => [ymd(e.date), e]));
    const days = dates.map((d) => {
      const k = ymd(d);
      const e = byDate.get(k);
      return e ? this.dto(e) : { date: k, mood_index: null, intention: null, reflection: null };
    });
    return { week_start: ymd(monday), days };
  }

  /** GET /mood-entries/today?field= — booleans that drive check-in prompts. */
  async today(field?: string) {
    const date = toUtcDate(ymd(new Date()));
    const entry = await this.prisma.moodEntry.findUnique({
      where: { user_id_date: { user_id: this.rc.userId, date } },
    });
    const moodLogged = entry?.mood_index != null;
    const reflectionLogged = entry?.reflection != null && entry.reflection !== '';
    if (field === 'mood') return { today_mood_logged: moodLogged };
    if (field === 'reflection') return { today_reflection_logged: reflectionLogged };
    return { today_mood_logged: moodLogged, today_reflection_logged: reflectionLogged };
  }

  // ---- internals ---------------------------------------------------------

  /** Idempotent activity-ledger append (§4.7) keyed (user, source, ref_id). */
  private async appendActivity(refId: string, eventDate: Date) {
    await this.prisma.activityEvent.upsert({
      where: { user_id_source_ref_id: { user_id: this.rc.userId, source: 'mood_log', ref_id: refId } },
      create: { user_id: this.rc.userId, source: 'mood_log', ref_id: refId, event_date: eventDate },
      update: {},
    });
    await this.redis.client.del(`streaks:current:${this.rc.userId}`);
    await this.rev.bump(this.rc.userId, 'mood');
  }

  private dto(e: { date: Date; mood_index: number | null; intention: string | null; reflection: string | null }) {
    return { date: ymd(e.date), mood_index: e.mood_index, intention: e.intention, reflection: e.reflection };
  }
}
