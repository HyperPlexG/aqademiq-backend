// §2.7 — /v1/mood-entries. Port of mood.controller.ts.
// Static routes (/week, /today) are registered before `/:date` so they win.
import { Hono } from 'hono';
import { moodService, type LogMoodDto, type ReflectionDto } from '../services/mood.service.ts';
import { jsonBody, str, num } from '../../_shared/validate.ts';

export const moodRouter = new Hono();

moodRouter.get('/week', async (c) => c.json(await moodService.week(c.req.query('date'))));

moodRouter.get('/today', async (c) => c.json(await moodService.today(c.req.query('field'))));

moodRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: LogMoodDto = {
    date: str(b, 'date', true, { pattern: /^\d{4}-\d{2}-\d{2}$/ })!,
    mood_index: num(b, 'mood_index', true, { int: true, min: 0, max: 4 })!,
    intention: str(b, 'intention', false, { min: 0, max: 2000 }),
  };
  return c.json(await moodService.log(dto), 201);
});

moodRouter.post('/:date/reflection', async (c) => {
  const b = await jsonBody(c.req);
  const dto: ReflectionDto = {
    reflection: str(b, 'reflection', true, { min: 0, max: 4000 })!,
  };
  return c.json(await moodService.reflect(c.req.param('date'), dto), 201);
});

moodRouter.get('/:date', async (c) => c.json(await moodService.getDay(c.req.param('date'))));
