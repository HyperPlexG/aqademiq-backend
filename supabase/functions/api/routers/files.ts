// §2.3/§4.4 — root-level file routes. Port of src/features/files/files.controller.ts
// (@Controller('/')). Mounted at '/' (root, under basePath /api/v1). Covers both
// /uploads/* and /files/* since the Nest controller is root-scoped.
import { Hono } from 'hono';
import {
  filesService,
  type InitUploadDto,
  type InitStagingUploadDto,
  type PatchFileDto,
} from '../services/files.service.ts';
import { jsonBody, str, num, bool } from '../../_shared/validate.ts';

export const filesRouter = new Hono();

// POST /uploads/init — InitUploadDto
filesRouter.post('/uploads/init', async (c) => {
  const b = await jsonBody(c.req);
  const dto: InitUploadDto = {
    subject_id: str(b, 'subject_id', true)!,
    name: str(b, 'name', true, { min: 1, max: 255 })!,
    kind: str(b, 'kind', false),
    mime_type: str(b, 'mime_type', false),
    size_bytes: num(b, 'size_bytes', false, { int: true, min: 0 }),
  };
  return c.json(await filesService.initUpload(dto), 201);
});

// POST /uploads/staging/init — InitStagingUploadDto
filesRouter.post('/uploads/staging/init', async (c) => {
  const b = await jsonBody(c.req);
  const dto: InitStagingUploadDto = {
    name: str(b, 'name', true, { min: 1, max: 255 })!,
    kind: str(b, 'kind', false),
    mime_type: str(b, 'mime_type', false),
    size_bytes: num(b, 'size_bytes', false, { int: true, min: 0 }),
  };
  return c.json(await filesService.initStagingUpload(dto), 201);
});

// POST /uploads/:id/commit
filesRouter.post('/uploads/:id/commit', async (c) => {
  return c.json(await filesService.commitUpload(c.req.param('id')), 201);
});

// DELETE /files/:id
filesRouter.delete('/files/:id', async (c) => {
  return c.json(await filesService.remove(c.req.param('id')));
});

// PATCH /files/:id — PatchFileDto
filesRouter.patch('/files/:id', async (c) => {
  const b = await jsonBody(c.req);
  const dto: PatchFileDto = {
    important: bool(b, 'important', false),
    name: str(b, 'name', false, { min: 1, max: 255 }),
  };
  return c.json(await filesService.patch(c.req.param('id'), dto));
});

// GET /files/:id/download
filesRouter.get('/files/:id/download', async (c) => {
  return c.json(await filesService.download(c.req.param('id')));
});

// GET /files/:id/thumbnail
filesRouter.get('/files/:id/thumbnail', async (c) => {
  return c.json(await filesService.thumbnail(c.req.param('id')));
});
