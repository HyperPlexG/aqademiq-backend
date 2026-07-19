// §2.4 — /v1/focus-sessions. Port of focus.controller.ts.
import { Hono } from 'hono';
import { focusService, type StartFocusDto, type CheckpointFocusDto, type CompleteFocusDto } from '../services/focus.service.ts';
import { jsonBody, str, num } from '../../_shared/validate.ts';

export const focusRouter = new Hono();

focusRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: StartFocusDto = {
    planned_min: num(b, 'planned_min', false, { int: true, min: 5, max: 120 }),
    prism_mode: str(b, 'prism_mode', false),
    task_id: str(b, 'task_id', false),
    task_date: str(b, 'task_date', false, { pattern: /^\d{4}-\d{2}-\d{2}$/ }),
  };
  return c.json(await focusService.start(dto), 201);
});

focusRouter.patch('/:id', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CheckpointFocusDto = {
    elapsed_sec: num(b, 'elapsed_sec', false, { int: true, min: 0 }),
    status: str(b, 'status', false, { enum: ['RUNNING', 'PAUSED'] }),
  };
  return c.json(await focusService.checkpoint(c.req.param('id'), dto));
});

focusRouter.post('/:id/complete', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CompleteFocusDto = {
    elapsed_sec: num(b, 'elapsed_sec', false, { int: true, min: 0 }),
    mood_index: num(b, 'mood_index', false, { int: true, min: 0, max: 4 }),
  };
  return c.json(await focusService.complete(c.req.param('id'), dto), 201);
});
