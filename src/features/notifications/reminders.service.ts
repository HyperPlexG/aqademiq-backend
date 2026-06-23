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

/**
 * §4.5 — per-tz reminder sweep. A cron tick resolves each active device's
 * **local wall-clock** time against the user's notification settings and
 * enqueues due reminders to the BullMQ `reminders` queue (the worker sends +
 * dedups). Cron is env-gated (REMINDERS_CRON=on) so it stays quiet in dev; the
 * sweep can also be triggered per-user for testing.
 *
 * Runs outside any request, so it uses raw `prisma.*` and iterates users
 * explicitly rather than the tenant extension.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly rc: RequestContext,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cronSweep() {
    if (process.env.REMINDERS_CRON !== 'on') return; // opt-in; off by default
    await this.sweep();
  }

  /** Sweep all devices (cron) or one user's (manual/test). `force` ignores the
   *  time-of-day match and enqueues that channel for today (testing aid). */
  async sweep(userId?: string, force?: string) {
    const devices = await this.prisma.device.findMany({
      where: { revoked_at: null, ...(userId ? { user_id: userId } : {}) },
    });

    let enqueued = 0;
    for (const d of devices) {
      const { localDate, localHHMM } = this.localNow(d.timezone);
      const settings = await this.prisma.settingsPrefs.findUnique({ where: { user_id: d.user_id } });
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

  /** Which reminder channels are due at this local time (§2.9 catalog subset). */
  private computeDue(settings: any, localHHMM: string, force?: string): DueReminder[] {
    const morningAt = settings?.notification_time_morning ?? '08:00';
    const reviewAt = settings?.notification_time_review ?? '20:00';
    const due: DueReminder[] = [];

    if (force === 'morning' || localHHMM === morningAt) {
      due.push({ channel: 'morning', title: 'Morning check-in', body: 'How are you feeling today? Set your intention 🎯' });
    }
    if (force === 'review' || localHHMM === reviewAt) {
      due.push({ channel: 'review', title: 'Evening review', body: 'Take a moment to reflect on your day 🌙' });
    }
    return due;
  }

  /** Local date (yyyy-MM-dd) + HH:MM for an IANA timezone. */
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

  /** Manual trigger for the current user (test/debug). */
  triggerForCurrentUser(force?: string) {
    return this.sweep(this.rc.userId, force);
  }
}
