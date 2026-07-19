// §2.8 — /v1/profile + /v1/me/stats. Port of profile.controller.ts + stats.controller.ts.
import { Hono } from 'hono';
import { profileService, type UpdateProfileDto } from '../services/profile.service.ts';
import { jsonBody, str, num } from '../../_shared/validate.ts';

export const profileRouter = new Hono();

profileRouter.get('/', async (c) => c.json(await profileService.get()));

profileRouter.patch('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateProfileDto = {
    name: str(b, 'name', false, { max: 120 }),
    gender: str(b, 'gender', false, { max: 40 }),
    date_of_birth: str(b, 'date_of_birth', false, { pattern: /^\d{4}-\d{2}-\d{2}$/ }),
    university: str(b, 'university', false, { max: 200 }),
    program: str(b, 'program', false, { max: 200 }),
    avatar_index: num(b, 'avatar_index', false, { int: true, min: 0, max: 7 }),
  };
  return c.json(await profileService.update(dto));
});

profileRouter.delete('/account', async (c) => c.json(await profileService.deleteAccount()));

// Mounted separately at /me
export const meRouter = new Hono();
meRouter.get('/stats', async (c) => c.json(await profileService.stats()));
