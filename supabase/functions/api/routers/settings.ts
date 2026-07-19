// §2.8/§2.9 — /v1/me settings, email/notification preferences, channels, export.
// Port of src/features/settings/settings.controller.ts (@Controller('me')).
import { Hono } from 'hono';
import {
  settingsService,
  type PutChannelsDto,
  type UpdateEmailPrefsDto,
  type UpdateNotificationPrefsDto,
  type UpdateSettingsDto,
} from '../services/settings.service.ts';
import { jsonBody, num, str } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SOUNDS = ['Chime', 'Pulse', 'Glass', 'Drop', 'None'] as const;
const THEMES = ['light', 'dark', 'system'] as const;

export const settingsRouter = new Hono();

settingsRouter.get('/settings', async (c) => c.json(await settingsService.getSettings()));

settingsRouter.patch('/settings', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateSettingsDto = {
    theme_mode: str(b, 'theme_mode', false, { enum: THEMES }),
    prism_default_mode: str(b, 'prism_default_mode', false),
    notification_sound: str(b, 'notification_sound', false, { enum: SOUNDS }),
    notification_time: str(b, 'notification_time', false, { pattern: HHMM }),
    notification_time_morning: str(b, 'notification_time_morning', false, { pattern: HHMM }),
    notification_time_review: str(b, 'notification_time_review', false, { pattern: HHMM }),
    daily_focus_goal_min: num(b, 'daily_focus_goal_min', false, { int: true, min: 0, max: 1440 }),
    work_best_times: b.work_best_times,
    education_level: str(b, 'education_level', false),
  };
  return c.json(await settingsService.patchSettings(dto));
});

settingsRouter.get('/email-preferences', async (c) => c.json(await settingsService.getEmailPrefs()));

settingsRouter.patch('/email-preferences', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateEmailPrefsDto = {
    product_updates: boolOpt(b, 'product_updates'),
    study_tips: boolOpt(b, 'study_tips'),
    offers: boolOpt(b, 'offers'),
    surveys: boolOpt(b, 'surveys'),
  };
  return c.json(await settingsService.patchEmailPrefs(dto));
});

settingsRouter.get('/notification-preferences', async (c) => c.json(await settingsService.getNotificationPrefs()));

settingsRouter.patch('/notification-preferences', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateNotificationPrefsDto = {
    notification_sound: str(b, 'notification_sound', false, { enum: SOUNDS }),
    notification_time: str(b, 'notification_time', false, { pattern: HHMM }),
    notification_time_morning: str(b, 'notification_time_morning', false, { pattern: HHMM }),
    notification_time_review: str(b, 'notification_time_review', false, { pattern: HHMM }),
  };
  return c.json(await settingsService.patchNotificationPrefs(dto));
});

settingsRouter.get('/notification-channels', async (c) => c.json(await settingsService.getNotificationChannels()));

settingsRouter.put('/notification-channels', async (c) => {
  const b = await jsonBody(c.req);
  const raw = b.channels;
  if (!Array.isArray(raw)) throw new HttpError(422, 'channels must be an array');
  const channels = raw.map((item, i) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(422, `channels[${i}] must be an object`);
    }
    const ch = item as Record<string, unknown>;
    return {
      channel_key: str(ch, 'channel_key', true)!,
      enabled: boolReq(ch, 'enabled'),
      send_time: str(ch, 'send_time', false, { pattern: HHMM }),
    };
  });
  const dto: PutChannelsDto = { channels };
  return c.json(await settingsService.putNotificationChannels(dto));
});

settingsRouter.get('/export', async (c) => c.json(await settingsService.exportData()));

// ---- local body helpers --------------------------------------------------

function boolOpt(b: Record<string, unknown>, field: string): boolean | undefined {
  const v = b[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new HttpError(422, `${field} must be a boolean`);
  return v;
}

function boolReq(b: Record<string, unknown>, field: string): boolean {
  const v = b[field];
  if (typeof v !== 'boolean') throw new HttpError(422, `${field} must be a boolean`);
  return v;
}
