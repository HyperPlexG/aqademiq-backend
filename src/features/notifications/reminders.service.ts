import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma.service';
import { QueueService } from '../../infra/queue.service';
import { RequestContext } from '../../common/request-context';

interface DueReminder {
  channel: string;
  title: string;
  body: string;
}

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly rc: RequestContext,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cronSweep() {
    if (process.env.REMINDERS_CRON !== 'on') return;
    await this.sweep();
  }

  async sweep(userId?: string, force?: string) {
    const devices = await this.prisma.deviceProfile.findMany({
      where: userId ? { user_id: userId } : {},
    });

    let enqueued = 0;
    for (const d of devices) {
      const u = await this.prisma.profile.findUnique({ where: { id: d.user_id } });
      const tz = u?.timezone ?? 'UTC';
      const { localDate, localHHMM } = this.localNow(tz);
      const settings = await this.prisma.notificationPreferences.findUnique({ where: { user_id: d.user_id } });
      const due = await this.computeDue(settings, localHHMM, force);
      for (const r of due) {
        const idempotencyKey = `${d.user_id}:${r.channel}:${localDate}`;
        await this.queue.reminders.add(
          'send',
          { userId: d.user_id, deviceId: d.id, channelKey: r.channel, localDate, title: r.title, body: r.body, idempotencyKey },
          { jobId: idempotencyKey, removeOnComplete: true, removeOnFail: true },
        );
        enqueued++;
      }
    }
    return { enqueued };
  }

  private computeDue(settings: any, localHHMM: string, force?: string): DueReminder[] {
    const formatTime = (t?: Date | null, def = '08:00') => {
      if (!t) return def;
      try {
        return t instanceof Date ? t.toISOString().slice(11, 16) : String(t).slice(11, 16);
      } catch {
        return def;
      }
    };

    const morningAt = formatTime(settings?.morning_checkin_time, '08:00');
    const reviewAt = formatTime(settings?.evening_review_time, '20:00');
    const due: DueReminder[] = [];

    if (settings?.morning_checkin_enabled !== false) {
      if (force === 'morning' || localHHMM === morningAt) {
        due.push({ channel: 'morning', title: 'Morning check-in', body: 'How are you feeling today? Set your intention 🎯' });
      }
    }
    if (settings?.evening_review_enabled !== false) {
      if (force === 'review' || localHHMM === reviewAt) {
        due.push({ channel: 'review', title: 'Evening review', body: 'Take a moment to reflect on your day 🌙' });
      }
    }
    return due;
  }

  private localNow(tz: string): { localDate: string; localHHMM: string } {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
      const hour = get('hour') === '24' ? '00' : get('hour');
      return { localDate: `${get('year')}-${get('month')}-${get('day')}`, localHHMM: `${hour}:${get('minute')}` };
    } catch {
      const d = new Date();
      return { localDate: d.toISOString().slice(0, 10), localHHMM: d.toISOString().slice(11, 16) };
    }
  }

  triggerForCurrentUser(force?: string) {
    return this.sweep(this.rc.userId, force);
  }
}
