// §4.6 — /v1/sync. Port of sync.controller.ts.
import { Hono } from 'hono';
import { syncService, MUTATION_TYPES, type SyncMutationsDto, type SyncMutationDto, type MutationType } from '../services/sync.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

export const syncRouter = new Hono();

syncRouter.get('/changes', async (c) =>
  c.json(await syncService.changes(c.req.query('since'), c.req.query('from'), c.req.query('to'))));

syncRouter.post('/mutations', async (c) => {
  const b = await jsonBody(c.req);
  const raw = b.mutations;
  if (!Array.isArray(raw)) throw new HttpError(422, 'mutations must be an array');
  if (raw.length > 200) throw new HttpError(422, 'mutations must contain at most 200 items');
  const mutations: SyncMutationDto[] = raw.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(422, 'each mutation must be an object');
    }
    const mb = item as Record<string, unknown>;
    if (mb.payload !== undefined && (mb.payload === null || typeof mb.payload !== 'object' || Array.isArray(mb.payload))) {
      throw new HttpError(422, 'payload must be an object');
    }
    return {
      op_id: str(mb, 'op_id', true)!,
      type: str(mb, 'type', true, { enum: MUTATION_TYPES })! as MutationType,
      payload: mb.payload as Record<string, unknown> | undefined,
    };
  });
  const dto: SyncMutationsDto = { mutations };
  return c.json(await syncService.mutations(dto), 201);
});

syncRouter.get('/cursor', async (c) => c.json(await syncService.cursor()));
