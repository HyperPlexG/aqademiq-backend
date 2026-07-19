// §2.8 — /v1/study-tags. Port of tags.controller.ts.
import { Hono } from 'hono';
import { tagsService, type CreateTagDto } from '../services/tags.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

export const tagsRouter = new Hono();

tagsRouter.get('/', async (c) => c.json(await tagsService.list()));

tagsRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreateTagDto = {
    label: str(b, 'label', true, { min: 1, max: 60 })!,
    color: str(b, 'color', false, { pattern: /^#[0-9a-fA-F]{6}$/ }),
  };
  return c.json(await tagsService.create(dto), 201);
});

tagsRouter.delete('/:label', async (c) => c.json(await tagsService.remove(c.req.param('label'))));
