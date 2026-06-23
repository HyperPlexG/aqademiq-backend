import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RevisionService } from '../../infra/revision.service';
import {
  UpdateSettingsDto,
  UpdateEmailPrefsDto,
  UpdateNotificationPrefsDto,
  PutChannelsDto,
} from './dto/settings.dto';

/**
 * §2.8/§2.9 — settings, email preferences, and the notification preference
 * matrix. SettingsPrefs/EmailPreferences are 1:1 (keyed by user_id) and created
 * on demand; NotificationChannelPref is the per-channel matrix. Mutations bump
 * the sync revision for cross-device consistency.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  async getSettings() {
    const s = await this.prisma.settingsPrefs.findUnique({ where: { user_id: this.rc.userId } });
    return this.settingsDto(s);
  }

  async patchSettings(dto: UpdateSettingsDto) {
    const data = this.pruneSettings(dto);
    const s = await this.prisma.settingsPrefs.upsert({
      where: { user_id: this.rc.userId },
      create: { user_id: this.rc.userId, ...data },
      update: data,
    });
    await this.rev.bump(this.rc.userId, 'settings');
    return this.settingsDto(s);
  }

  async getEmailPrefs() {
    const e = await this.prisma.emailPreferences.findUnique({ where: { user_id: this.rc.userId } });
    return this.emailDto(e);
  }

  async patchEmailPrefs(dto: UpdateEmailPrefsDto) {
    const data: Record<string, unknown> = {};
    for (const k of ['product_updates', 'study_tips', 'offers', 'surveys'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    const e = await this.prisma.emailPreferences.upsert({
      where: { user_id: this.rc.userId },
      create: { user_id: this.rc.userId, ...data },
      update: data,
    });
    await this.rev.bump(this.rc.userId, 'email_preferences');
    return this.emailDto(e);
  }

  /** GET /me/notification-preferences — sound + global times + channel matrix. */
  async getNotificationPrefs() {
    const [s, channels] = await Promise.all([
      this.prisma.settingsPrefs.findUnique({ where: { user_id: this.rc.userId } }),
      this.prisma.notificationChannelPref.findMany({ where: { user_id: this.rc.userId }, orderBy: { channel_key: 'asc' } }),
    ]);
    const d = this.settingsDto(s);
    return {
      notification_sound: d.notification_sound,
      notification_time: d.notification_time,
      notification_time_morning: d.notification_time_morning,
      notification_time_review: d.notification_time_review,
      channels: channels.map((c) => this.channelDto(c)),
    };
  }

  async patchNotificationPrefs(dto: UpdateNotificationPrefsDto) {
    const data: Record<string, unknown> = {};
    for (const k of ['notification_sound', 'notification_time', 'notification_time_morning', 'notification_time_review'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    await this.prisma.settingsPrefs.upsert({
      where: { user_id: this.rc.userId },
      create: { user_id: this.rc.userId, ...data },
      update: data,
    });
    await this.rev.bump(this.rc.userId, 'notification_preferences');
    return this.getNotificationPrefs();
  }

  async getNotificationChannels() {
    const channels = await this.prisma.notificationChannelPref.findMany({
      where: { user_id: this.rc.userId },
      orderBy: { channel_key: 'asc' },
    });
    return { channels: channels.map((c) => this.channelDto(c)) };
  }

  /** PUT /me/notification-channels — upsert each channel (replace semantics). */
  async putNotificationChannels(dto: PutChannelsDto) {
    for (const ch of dto.channels) {
      await this.prisma.notificationChannelPref.upsert({
        where: { user_id_channel_key: { user_id: this.rc.userId, channel_key: ch.channel_key } },
        create: { user_id: this.rc.userId, channel_key: ch.channel_key, enabled: ch.enabled, send_time: ch.send_time ?? null },
        update: { enabled: ch.enabled, send_time: ch.send_time ?? null },
      });
    }
    await this.rev.bump(this.rc.userId, 'notification_channels');
    return this.getNotificationChannels();
  }

  /** GET /me/export — §4.9 data export (basic aggregation of user-owned data). */
  async exportData() {
    const db = this.prisma.tenant;
    const [profile, settings, email, semesters, subjects, series, mood, tags, channels] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { user_id: this.rc.userId } }),
      this.prisma.settingsPrefs.findUnique({ where: { user_id: this.rc.userId } }),
      this.prisma.emailPreferences.findUnique({ where: { user_id: this.rc.userId } }),
      db.semester.findMany(),
      db.subject.findMany(),
      db.taskSeries.findMany({ include: { overrides: true, steps: true } }),
      db.moodEntry.findMany(),
      db.studyTag.findMany(),
      this.prisma.notificationChannelPref.findMany({ where: { user_id: this.rc.userId } }),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile,
      settings,
      email_preferences: email,
      semesters,
      subjects,
      task_series: series,
      mood_entries: mood,
      study_tags: tags,
      notification_channels: channels,
    };
  }

  // ---- internals ---------------------------------------------------------

  private pruneSettings(dto: UpdateSettingsDto) {
    const data: Record<string, unknown> = {};
    const keys = [
      'theme_mode', 'prism_default_mode', 'notification_sound', 'notification_time',
      'notification_time_morning', 'notification_time_review', 'daily_focus_goal_min', 'education_level',
    ] as const;
    for (const k of keys) if (dto[k] !== undefined) data[k] = dto[k];
    if (dto.work_best_times !== undefined) data.work_best_times = dto.work_best_times as object;
    return data;
  }

  private settingsDto(s: any) {
    return {
      theme_mode: s?.theme_mode ?? 'system',
      prism_default_mode: s?.prism_default_mode ?? null,
      notification_sound: s?.notification_sound ?? 'Chime',
      notification_time: s?.notification_time ?? '07:00',
      notification_time_morning: s?.notification_time_morning ?? '08:00',
      notification_time_review: s?.notification_time_review ?? '20:00',
      daily_focus_goal_min: s?.daily_focus_goal_min ?? 120,
      work_best_times: s?.work_best_times ?? null,
      education_level: s?.education_level ?? null,
    };
  }

  private emailDto(e: any) {
    return {
      product_updates: e?.product_updates ?? true,
      study_tips: e?.study_tips ?? true,
      offers: e?.offers ?? false,
      surveys: e?.surveys ?? false,
    };
  }

  private channelDto(c: { channel_key: string; enabled: boolean; send_time: string | null }) {
    return { channel_key: c.channel_key, enabled: c.enabled, send_time: c.send_time };
  }
}
