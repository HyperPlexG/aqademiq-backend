// §2.8/§2.9 — settings, email/notification preferences, channels, export.
// Port of src/features/settings/settings.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { revision } from '../../_shared/revision.ts';

export interface UpdateSettingsDto {
  theme_mode?: string;
  prism_default_mode?: string;
  notification_sound?: string;
  notification_time?: string;
  notification_time_morning?: string;
  notification_time_review?: string;
  daily_focus_goal_min?: number;
  work_best_times?: unknown;
  education_level?: string;
}

export interface UpdateEmailPrefsDto {
  product_updates?: boolean;
  study_tips?: boolean;
  offers?: boolean;
  surveys?: boolean;
}

export interface UpdateNotificationPrefsDto {
  notification_sound?: string;
  notification_time?: string;
  notification_time_morning?: string;
  notification_time_review?: string;
}

export interface ChannelPrefDto {
  channel_key: string;
  enabled: boolean;
  send_time?: string;
}

export interface PutChannelsDto {
  channels: ChannelPrefDto[];
}

// ---- internals -----------------------------------------------------------

function parseTime(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function formatTime(d: Date | null | undefined): string {
  if (!d) return '00:00';
  try {
    return d instanceof Date ? d.toISOString().slice(11, 16) : String(d).slice(11, 16);
  } catch {
    return '00:00';
  }
}

export const settingsService = {
  async getSettings() {
    const userId = RequestContext.userId;
    const [profile, appSettings, notif] = await Promise.all([
      prismaBase().userProfile.findUnique({ where: { user_id: userId } }),
      prismaBase().userAppSettings.findUnique({ where: { user_id: userId } }),
      prismaBase().notificationPreferences.findUnique({ where: { user_id: userId } }),
    ]);
    return {
      theme_mode: appSettings?.appearance ?? 'system',
      prism_default_mode: appSettings?.focus_timer_style ?? null,
      notification_sound: notif?.notification_sound ?? 'Chime',
      notification_time: notif ? formatTime(notif.morning_checkin_time) : '07:00',
      notification_time_morning: notif ? formatTime(notif.morning_checkin_time) : '08:00',
      notification_time_review: notif ? formatTime(notif.evening_review_time) : '20:00',
      daily_focus_goal_min: profile?.daily_focus_goal_mins ?? 120,
      work_best_times: null,
      education_level: profile?.study_level ?? null,
    };
  },

  async patchSettings(dto: UpdateSettingsDto) {
    const userId = RequestContext.userId;

    // deno-lint-ignore no-explicit-any
    const profileData: Record<string, any> = {};
    if (dto.daily_focus_goal_min !== undefined) profileData.daily_focus_goal_mins = dto.daily_focus_goal_min;
    if (dto.education_level !== undefined) profileData.study_level = dto.education_level;

    if (Object.keys(profileData).length > 0) {
      await prismaBase().userProfile.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...profileData },
        update: profileData,
      });
    }

    // deno-lint-ignore no-explicit-any
    const appData: Record<string, any> = {};
    if (dto.theme_mode !== undefined) appData.appearance = dto.theme_mode;
    if (dto.prism_default_mode !== undefined) appData.focus_timer_style = dto.prism_default_mode;

    if (Object.keys(appData).length > 0) {
      await prismaBase().userAppSettings.upsert({
        where: { user_id: userId },
        create: { user_id: userId, ...appData },
        update: appData,
      });
    }

    // deno-lint-ignore no-explicit-any
    const notifData: Record<string, any> = {};
    if (dto.notification_sound !== undefined) notifData.notification_sound = dto.notification_sound;
    if (dto.notification_time_morning !== undefined) notifData.morning_checkin_time = parseTime(dto.notification_time_morning);
    if (dto.notification_time_review !== undefined) notifData.evening_review_time = parseTime(dto.notification_time_review);

    if (Object.keys(notifData).length > 0) {
      await prismaBase().notificationPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId, morning_checkin_time: parseTime('08:00'), evening_review_time: parseTime('20:00'), weekly_review_time: parseTime('15:00'), ...notifData },
        update: notifData,
      });
    }

    await revision.bump(userId, 'settings');
    return this.getSettings();
  },

  async getEmailPrefs() {
    const notif = await prismaBase().notificationPreferences.findUnique({ where: { user_id: RequestContext.userId } });
    return {
      product_updates: notif?.product_updates_enabled ?? true,
      study_tips: notif?.email_enabled ?? true,
      offers: false,
      surveys: false,
    };
  },

  async patchEmailPrefs(dto: UpdateEmailPrefsDto) {
    const userId = RequestContext.userId;
    // deno-lint-ignore no-explicit-any
    const updateData: Record<string, any> = {};
    if (dto.product_updates !== undefined) updateData.product_updates_enabled = dto.product_updates;
    if (dto.study_tips !== undefined) updateData.email_enabled = dto.study_tips;

    const notif = await prismaBase().notificationPreferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        morning_checkin_time: parseTime('08:00'),
        evening_review_time: parseTime('20:00'),
        weekly_review_time: parseTime('15:00'),
        ...updateData,
      },
      update: updateData,
    });
    await revision.bump(userId, 'email_preferences');
    return {
      product_updates: notif.product_updates_enabled,
      study_tips: notif.email_enabled,
      offers: false,
      surveys: false,
    };
  },

  async getNotificationPrefs() {
    const userId = RequestContext.userId;
    const [settings, notif] = await Promise.all([
      this.getSettings(),
      prismaBase().notificationPreferences.findUnique({ where: { user_id: userId } }),
    ]);

    const channels = [
      { channel_key: 'morning', enabled: notif?.morning_checkin_enabled ?? true, send_time: settings.notification_time_morning },
      { channel_key: 'review', enabled: notif?.evening_review_enabled ?? true, send_time: settings.notification_time_review },
      { channel_key: 'weekly_review', enabled: notif?.weekly_review_enabled ?? true, send_time: notif ? formatTime(notif.weekly_review_time) : '15:00' },
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
  },

  async patchNotificationPrefs(dto: UpdateNotificationPrefsDto) {
    const userId = RequestContext.userId;
    // deno-lint-ignore no-explicit-any
    const notifData: Record<string, any> = {};
    if (dto.notification_sound !== undefined) notifData.notification_sound = dto.notification_sound;
    if (dto.notification_time_morning !== undefined) notifData.morning_checkin_time = parseTime(dto.notification_time_morning);
    if (dto.notification_time_review !== undefined) notifData.evening_review_time = parseTime(dto.notification_time_review);

    await prismaBase().notificationPreferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        morning_checkin_time: parseTime('08:00'),
        evening_review_time: parseTime('20:00'),
        weekly_review_time: parseTime('15:00'),
        ...notifData,
      },
      update: notifData,
    });
    await revision.bump(userId, 'notification_preferences');
    return this.getNotificationPrefs();
  },

  async getNotificationChannels() {
    const prefs = await this.getNotificationPrefs();
    return { channels: prefs.channels };
  },

  async putNotificationChannels(dto: PutChannelsDto) {
    const userId = RequestContext.userId;
    // deno-lint-ignore no-explicit-any
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
          updateData.weekly_review_time = parseTime(ch.send_time);
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prismaBase().notificationPreferences.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          morning_checkin_time: parseTime('08:00'),
          evening_review_time: parseTime('20:00'),
          weekly_review_time: parseTime('15:00'),
          ...updateData,
        },
        update: updateData,
      });
    }

    await revision.bump(userId, 'notification_channels');
    return this.getNotificationChannels();
  },

  async exportData() {
    const db = tenantDb();
    const userId = RequestContext.userId;
    const [profile, appSettings, notif, semesters, subjects, series, mood, tags] = await Promise.all([
      prismaBase().userProfile.findUnique({ where: { user_id: userId } }),
      prismaBase().userAppSettings.findUnique({ where: { user_id: userId } }),
      prismaBase().notificationPreferences.findUnique({ where: { user_id: userId } }),
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
  },
};
