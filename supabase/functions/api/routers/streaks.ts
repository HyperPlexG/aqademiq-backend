// §2.6 — /v1/streaks + root activity endpoints. Port of streaks.controller.ts + activity.controller.ts.
import { Hono } from 'hono';
import { streaksService } from '../services/streaks.service.ts';

export const streaksRouter = new Hono();
streaksRouter.get('/current', async (c) => c.json(await streaksService.current()));

// Root-level activity endpoints (mounted at basePath, not under /streaks).
export const activityRouter = new Hono();
activityRouter.get('/activity-dates', async (c) => c.json(await streaksService.activityDates()));
activityRouter.get('/week-count', async (c) => c.json(await streaksService.weekCount(c.req.query('date'))));
activityRouter.get('/today-has-activity', async (c) => c.json(await streaksService.todayHasActivity()));
