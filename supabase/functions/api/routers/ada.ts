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
// Legacy propose-then-apply path, kept for conversations that predate the agent.
adaRouter.post('/conversations/:cid/messages/:mid/apply-plan', async (c) =>
  c.json(await adaService.applyPlan(c.req.param('cid'), c.req.param('mid')), 201));

// ---- memory --------------------------------------------------------------
// Ada can recall and forget these itself, but the user must be able to inspect
// and delete what is stored about them without going through the assistant.

// GET /ada/memories
adaRouter.get('/memories', async (c) => c.json(await adaService.memories()));

// DELETE /ada/memories — forget everything (before the :id route).
adaRouter.delete('/memories', async (c) => c.json(await adaService.clearMemories()));

// DELETE /ada/memories/:id
adaRouter.delete('/memories/:id', async (c) =>
  c.json(await adaService.deleteMemory(c.req.param('id'))));

// ---- agent confirmation gate --------------------------------------------
// Every create/update/delete the agent proposes waits here until the user acts.

// GET /ada/pending-actions[?conversation_id=]
adaRouter.get('/pending-actions', async (c) =>
  c.json(await adaService.pendingActions(c.req.query('conversation_id') || undefined)));

// These four decide or archive existing rows — nothing is created, so they
// answer 200, not 201. Dio treats the whole 2xx range as success, so this is
// transparent to the client; it only stops the edge logs reading as a wall of
// "201 Created" for operations that create nothing.

// POST /ada/actions/:id/approve — execute it, then let the agent continue.
adaRouter.post('/actions/:id/approve', async (c) =>
  c.json(await adaService.approve(c.req.param('id'))));

// POST /ada/actions/:id/reject
adaRouter.post('/actions/:id/reject', async (c) =>
  c.json(await adaService.reject(c.req.param('id'))));

// POST /ada/conversations/:id/actions/decide  { approve: boolean }
adaRouter.post('/conversations/:id/actions/decide', async (c) => {
  const b = await jsonBody(c.req);
  const approve = b.approve;
  if (typeof approve !== 'boolean') throw new HttpError(422, 'approve must be a boolean');
  return c.json(await adaService.decideAllActions(c.req.param('id'), approve));
});

// POST /ada/conversations/:id/archive
adaRouter.post('/conversations/:id/archive', async (c) =>
  c.json(await adaService.archive(c.req.param('id'))));

// POST /ada/chat/clear
adaRouter.post('/chat/clear', async (c) => c.json(await adaService.clear()));

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
