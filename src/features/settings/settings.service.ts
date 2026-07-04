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

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
  ) {}

  async getSettings() {
    const userId = this.rc.userId;
    const [profile, appSettings, notif] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { user_id: userId } }),
      this.prisma.userAppSettings.findUnique({ where: { user_id: userId } }),
      this.prisma.notificationPreferences.findUnique({ where: { user_id: userId } }),
    ]);
    return {
      theme_mode: appSettings?.appearance ?? 'system',
      prism_default_mode: appSettings?.focus_timer_style ?? null,
      notification_sound: notif?.notification_sound ?? 'Chime',
      notification_time: notif ? this.formatTime(notif.morning_checkin_time) : '07:00',
      notification_time_morning: notif ? this.formatTime(notif.morning_checkin_time) : '08:00',
      notification_time_review: notif ? this.formatTime(notif.evening_review_time) : '20:00',
      daily_focus_goal_min: profile?.daily_focus_goal_mins ?? 120,
      work_best_times: null,
      education_level: profile?.study_level ?? null,
    };
  }

  async patchSettings(dto: UpdateSettingsDto) {
    const userId = this.rc.userId;
    
    const profileData: Record<string, any> = {};
    if (dto.daily_focus_goal_min !== undefined) profileData.daily_focus_goal_mins = dto.daily_focus_goal_min;
    if (dto.education_level !== undefined) profileData.study_level = dto.education_level;
    
    if (Object.keys(profileData).length > 0) {
      await this.prisma.userProfile.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...profileData },
        update: profileData,
      });
    }

    const appData: Record<string, any> = {};
    if (dto.theme_mode !== undefined) appData.appearance = dto.theme_mode;
    if (dto.prism_default_mode !== undefined) appData.focus_timer_style = dto.prism_default_mode;
    
    if (Object.keys(appData).length > 0) {
      await this.prisma.userAppSettings.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...appData },
        update: appData,
      });
    }

    const notifData: Record<string, any> = {};
    if (dto.notification_sound !== undefined) notifData.notification_sound = dto.notification_sound;
    if (dto.notification_time_morning !== undefined) notifData.morning_checkin_time = this.parseTime(dto.notification_time_morning);
    if (dto.notification_time_review !== undefined) notifData.evening_review_time = this.parseTime(dto.notification_time_review);
    
    if (Object.keys(notifData).length > 0) {
      await this.prisma.notificationPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId, morning_checkin_time: this.parseTime('08:00'), evening_review_time: this.parseTime('20:00'), weekly_review_time: this.parseTime('15:00'), ...notifData },
        update: notifData,
      });
    }

    await this.rev.bump(userId, 'settings');
    return this.getSettings();
  }

  async getEmailPrefs() {
    const notif = await this.prisma.notificationPreferences.findUnique({ where: { user_id: this.rc.userId } });
    return {
      product_updates: notif?.product_updates_enabled ?? true,
      study_tips: notif?.email_enabled ?? true,
      offers: false,
      surveys: false,
    };
  }

  async patchEmailPrefs(dto: UpdateEmailPrefsDto) {
    const userId = this.rc.userId;
    const updateData: Record<string, any> = {};
    if (dto.product_updates !== undefined) updateData.product_updates_enabled = dto.product_updates;
    if (dto.study_tips !== undefined) updateData.email_enabled = dto.study_tips;

    const notif = await this.prisma.notificationPreferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        morning_checkin_time: this.parseTime('08:00'),
        evening_review_time: this.parseTime('20:00'),
        weekly_review_time: this.parseTime('15:00'),
        ...updateData,
      },
      update: updateData,
    });
    await this.rev.bump(userId, 'email_preferences');
    return {
      product_updates: notif.product_updates_enabled,
      study_tips: notif.email_enabled,
      offers: false,
      surveys: false,
    };
  }

  async getNotificationPrefs() {
    const userId = this.rc.userId;
    const [settings, notif] = await Promise.all([
      this.getSettings(),
      this.prisma.notificationPreferences.findUnique({ where: { user_id: userId } }),
    ]);

    const channels = [
      { channel_key: 'morning', enabled: notif?.morning_checkin_enabled ?? true, send_time: settings.notification_time_morning },
      { channel_key: 'review', enabled: notif?.evening_review_enabled ?? true, send_time: settings.notification_time_review },
      { channel_key: 'weekly_review', enabled: notif?.weekly_review_enabled ?? true, send_time: notif ? this.formatTime(notif.weekly_review_time) : '15:00' },
      { channel_key: 'task_due', enabled: notif?.before_task_enabled ?? true, send_time: null },
      { channel_key: 'task_start', enabled: notif?.when_task_starts_enabled ?? true, send_time: null },
      { channel_key: 'task_half', enabled: notif?.halfway_through_enabled ?? false, send_time: null },
      { channel_key: 'task_end', enabled: notif?.when_task_finished_enabled ?? false, send_time: null },
    ];

    return {
      notification_sound: settings.notification_sound,
      notification_time: settings.notification_time,
      notification_time_morning: settings.notification_time_morning,
      notification_time_review: settings.notification_time_review,
      channels,
    };
  }

  async patchNotificationPrefs(dto: UpdateNotificationPrefsDto) {
    const userId = this.rc.userId;
    const notifData: Record<string, any> = {};
    if (dto.notification_sound !== undefined) notifData.notification_sound = dto.notification_sound;
    if (dto.notification_time_morning !== undefined) notifData.morning_checkin_time = this.parseTime(dto.notification_time_morning);
    if (dto.notification_time_review !== undefined) notifData.evening_review_time = this.parseTime(dto.notification_time_review);

    await this.prisma.notificationPreferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        morning_checkin_time: this.parseTime('08:00'),
        evening_review_time: this.parseTime('20:00'),
        weekly_review_time: this.parseTime('15:00'),
        ...notifData,
      },
      update: notifData,
    });
    await this.rev.bump(userId, 'notification_preferences');
    return this.getNotificationPrefs();
  }

  async getNotificationChannels() {
    const prefs = await this.getNotificationPrefs();
    return { channels: prefs.channels };
  }

  async putNotificationChannels(dto: PutChannelsDto) {
    const userId = this.rc.userId;
    const updateData: Record<string, any> = {};
    
    const keyMap: Record<string, string> = {
      morning: 'morning_checkin_enabled',
      review: 'evening_review_enabled',
      weekly_review: 'weekly_review_enabled',
      task_due: 'before_task_enabled',
      task_start: 'when_task_starts_enabled',
      task_half: 'halfway_through_enabled',
      task_end: 'when_task_finished_enabled',
    };

    for (const ch of dto.channels) {
      const col = keyMap[ch.channel_key];
      if (col) {
        updateData[col] = ch.enabled;
        if (ch.channel_key === 'weekly_review' && ch.send_time) {
          updateData.weekly_review_time = this.parseTime(ch.send_time);
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.notificationPreferences.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          morning_checkin_time: this.parseTime('08:00'),
          evening_review_time: this.parseTime('20:00'),
          weekly_review_time: this.parseTime('15:00'),
          ...updateData,
        },
        update: updateData,
      });
    }

    await this.rev.bump(userId, 'notification_channels');
    return this.getNotificationChannels();
  }

  async exportData() {
    const db = this.prisma.tenant;
    const [profile, appSettings, notif, semesters, subjects, series, mood, tags] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { user_id: this.rc.userId } }),
      this.prisma.userAppSettings.findUnique({ where: { user_id: this.rc.userId } }),
      this.prisma.notificationPreferences.findUnique({ where: { user_id: this.rc.userId } }),
      db.academicTerm.findMany(),
      db.course.findMany(),
      db.task.findMany({ include: { steps: true } }),
      db.moodCheckin.findMany(),
      db.studyTag.findMany(),
    ]);
    return {
      exported_at: new Date().toISOString(),
      profile,
      settings: appSettings,
      notification_preferences: notif,
      semesters,
      subjects,
      tasks: series,
      mood_entries: mood,
      study_tags: tags,
    };
  }

  // ---- internals ---------------------------------------------------------

  private parseTime(hhmm: string): Date {
    return new Date(`1970-01-01T${hhmm}:00.000Z`);
  }

  private formatTime(d: Date | null | undefined): string {
    if (!d) return '00:00';
    try {
      return d instanceof Date ? d.toISOString().slice(11, 16) : String(d).slice(11, 16);
    } catch {
      return '00:00';
    }
  }
}
