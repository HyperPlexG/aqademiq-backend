// §2.3 — /v1/semesters. Port of semesters.controller.ts. Static `active` before `:id`.
import { Hono } from 'hono';
import {
  semestersService,
  type CreateSemesterDto,
  type UpdateSemesterDto,
} from '../services/semesters.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const semestersRouter = new Hono();

semestersRouter.get('/active', async (c) => c.json(await semestersService.getActive()));

semestersRouter.get('/', async (c) => c.json(await semestersService.list()));

semestersRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreateSemesterDto = {
    name: str(b, 'name', true, { min: 1, max: 120 })!,
    start: str(b, 'start', true, { pattern: YMD })!,
    end: str(b, 'end', true, { pattern: YMD })!,
  };
  return c.json(await semestersService.create(dto), 201);
});

semestersRouter.patch('/:id/activate', async (c) => c.json(await semestersService.activate(c.req.param('id'))));

semestersRouter.patch('/:id', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateSemesterDto = {
    name: str(b, 'name', false, { min: 1, max: 120 }),
    start: str(b, 'start', false, { pattern: YMD }),
    end: str(b, 'end', false, { pattern: YMD }),
  };
  return c.json(await semestersService.update(c.req.param('id'), dto));
});

semestersRouter.delete('/:id', async (c) => c.json(await semestersService.remove(c.req.param('id'))));
