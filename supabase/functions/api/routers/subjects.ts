// §2.3 — /v1/subjects. Port of subjects.controller.ts. Static `reorder` before `:id`.
import { Hono } from 'hono';
import {
  subjectsService,
  type CreateSubjectDto,
  type UpdateSubjectDto,
  type ReorderSubjectsDto,
} from '../services/subjects.service.ts';
import { jsonBody, str, num } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

const HEX = /^#[0-9a-fA-F]{6}$/;

export const subjectsRouter = new Hono();

subjectsRouter.get('/', async (c) => c.json(await subjectsService.list(c.req.query('semester_id'))));

subjectsRouter.patch('/reorder', async (c) => {
  const b = await jsonBody(c.req);
  const raw = b.ids;
  if (!Array.isArray(raw)) throw new HttpError(422, 'ids must be an array');
  if (raw.length < 1) throw new HttpError(422, 'ids must contain at least 1 element');
  if (!raw.every((v) => typeof v === 'string')) throw new HttpError(422, 'ids must be an array of strings');
  const dto: ReorderSubjectsDto = { ids: raw as string[] };
  return c.json(await subjectsService.reorder(dto));
});

subjectsRouter.get('/:id', async (c) => c.json(await subjectsService.get(c.req.param('id'))));

subjectsRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreateSubjectDto = {
    name: str(b, 'name', true, { min: 1, max: 120 })!,
    color_hex: str(b, 'color_hex', true, { pattern: HEX })!,
    semester_id: str(b, 'semester_id', false),
    code: str(b, 'code', false),
    credits: num(b, 'credits', false),
    prof: str(b, 'prof', false),
    target_grade: str(b, 'target_grade', false),
    mood: num(b, 'mood', false, { int: true, min: 0, max: 4 }),
  };
  return c.json(await subjectsService.create(dto), 201);
});

subjectsRouter.patch('/:id', async (c) => {
  const b = await jsonBody(c.req);
  const dto: UpdateSubjectDto = {
    name: str(b, 'name', false, { min: 1, max: 120 }),
    color_hex: str(b, 'color_hex', false, { pattern: HEX }),
    semester_id: str(b, 'semester_id', false),
    code: str(b, 'code', false),
    credits: num(b, 'credits', false),
    prof: str(b, 'prof', false),
    target_grade: str(b, 'target_grade', false),
    mood: num(b, 'mood', false, { int: true, min: 0, max: 4 }),
  };
  return c.json(await subjectsService.update(c.req.param('id'), dto));
});

subjectsRouter.delete('/:id', async (c) => c.json(await subjectsService.remove(c.req.param('id'))));

subjectsRouter.post('/:id/files', async (c) => {
  const b = await jsonBody(c.req);
  const body = {
    name: typeof b.name === 'string' ? b.name : undefined,
    kind: typeof b.kind === 'string' ? b.kind : undefined,
    important: typeof b.important === 'boolean' ? b.important : undefined,
  };
  return c.json(await subjectsService.addFile(c.req.param('id'), body), 201);
});

subjectsRouter.post('/:id/files/scan', (c) => c.json(subjectsService.scanFile()));
