// §2.4/§2.11 — /v1/prism-modes. Port of prism.controller.ts.
import { Hono } from 'hono';
import { prismService, type UpdatePrismPreferencesDto } from '../services/prism.service.ts';
import { jsonBody, str, num, bool } from '../../_shared/validate.ts';

const MODE_KEYS = ['none', 'rain', 'forest', 'cafe', 'whitenoise'] as const;

export const prismRouter = new Hono();

// Static catalog: 4 modes + "No sound"; CDN URLs from the public bucket.
prismRouter.get('/', async (c) => c.json(await prismService.catalog()));

// The caller's saved Prism defaults (chosen mode, volume, adaptive, in-focus).
prismRouter.get('/preferences', async (c) => c.json(await prismService.getPreferences()));

// Upsert the caller's Prism defaults.
prismRouter.put('/preferences', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdatePrismPreferencesDto = {
    default_mode: str(b, 'default_mode', false, { enum: MODE_KEYS }),
    volume_level: num(b, 'volume_level', false, { int: true, min: 0, max: 100 }),
    adaptive_audio: bool(b, 'adaptive_audio', false),
    play_in_focus: bool(b, 'play_in_focus', false),
  };
  return c.json(await prismService.setPreferences(dto));
});
