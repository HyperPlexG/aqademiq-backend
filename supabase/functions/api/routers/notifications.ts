// §2.9 — /v1/me/notifications. Port of notifications.controller.ts.
import { Hono } from 'hono';
import { notificationsService } from '../services/notifications.service.ts';

export const notificationsRouter = new Hono();

notificationsRouter.get('/history', async (c) => c.json(await notificationsService.history()));

notificationsRouter.get('/inbox', async (c) => c.json(await notificationsService.inbox()));

notificationsRouter.post('/test', async (c) => c.json(await notificationsService.test(), 201));

// POST /me/notifications/sweep — DEGRADED. The Nest handler calls
// RemindersService.triggerForCurrentUser(force), which enqueues reminder jobs on a
// BullMQ queue (a background worker not present in the edge runtime). Per the port
// contract the reminders worker is NOT ported; scheduling is skipped and we return
// the same success shape the Nest sweep produces ({ enqueued }). `force` is read to
// preserve the request signature but has no effect here.
notificationsRouter.post('/sweep', async (c) => {
  const _force = c.req.query('force');
  return c.json({ enqueued: 0 }, 201);
});
