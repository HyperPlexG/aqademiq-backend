// §2.5/§4.3 — /v1/ada. Port of ada.controller.ts (@Controller('ada')).
import { Hono } from 'hono';
import {
  adaService,
  type CreateConversationDto,
  type PostMessageDto,
  type AdaUploadInitDto,
  type PlanWeekDto,
  type AdaAttachmentRefDto,
} from '../services/ada.service.ts';
import { jsonBody, str, num } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

export const adaRouter = new Hono();

// POST /ada/conversations
adaRouter.post('/conversations', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreateConversationDto = {
    title: str(b, 'title', false, { min: 1, max: 200 }),
  };
  return c.json(await adaService.createConversation(dto), 201);
});

// GET /ada/conversations
adaRouter.get('/conversations', async (c) => c.json(await adaService.listConversations()));

// GET /ada/conversations/:id/messages
adaRouter.get('/conversations/:id/messages', async (c) =>
  c.json(await adaService.listMessages(c.req.param('id'))));

// POST /ada/conversations/:id/messages
adaRouter.post('/conversations/:id/messages', async (c) => {
  const b = await jsonBody(c.req);
  const dto: PostMessageDto = {
    text: str(b, 'text', true, { min: 1, max: 8000 })!,
    attachments: parseAttachments(b.attachments),
  };
  return c.json(await adaService.postMessage(c.req.param('id'), dto), 201);
});

// POST /ada/conversations/:cid/messages/:mid/apply-plan
adaRouter.post('/conversations/:cid/messages/:mid/apply-plan', async (c) =>
  c.json(await adaService.applyPlan(c.req.param('cid'), c.req.param('mid')), 201));

// POST /ada/conversations/:id/archive
adaRouter.post('/conversations/:id/archive', async (c) =>
  c.json(await adaService.archive(c.req.param('id')), 201));

// POST /ada/chat/clear
adaRouter.post('/chat/clear', async (c) => c.json(await adaService.clear(), 201));

// POST /ada/uploads
adaRouter.post('/uploads', async (c) => {
  const b = await jsonBody(c.req);
  const dto: AdaUploadInitDto = {
    conversation_id: str(b, 'conversation_id', true)!,
    name: str(b, 'name', true, { min: 1, max: 255 })!,
    mime_type: str(b, 'mime_type', false),
    size_bytes: num(b, 'size_bytes', false, { int: true, min: 0 }),
  };
  return c.json(await adaService.upload(dto), 201);
});

// POST /ada/plan-week
adaRouter.post('/plan-week', async (c) => {
  const b = await jsonBody(c.req);
  const dto: PlanWeekDto = {
    start_date: str(b, 'start_date', false, { pattern: /^\d{4}-\d{2}-\d{2}$/ }),
    goal: str(b, 'goal', false, { min: 0, max: 500 }),
  };
  return c.json(await adaService.planWeek(dto), 201);
});

// ---- helpers -------------------------------------------------------------

/** Validate the optional attachments[] on PostMessageDto (AdaAttachmentRefDto[]). */
function parseAttachments(raw: unknown): AdaAttachmentRefDto[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new HttpError(422, 'attachments must be an array');
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new HttpError(422, `attachments[${i}] must be an object`);
    }
    const a = item as Record<string, unknown>;
    return {
      key: str(a, 'key', true)!,
      name: str(a, 'name', true, { min: 1, max: 255 })!,
      mime_type: str(a, 'mime_type', false),
    };
  });
}
