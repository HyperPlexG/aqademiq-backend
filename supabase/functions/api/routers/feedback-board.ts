// Feedback & roadmap board routers. Port of:
//   - feedback-board.controller.ts        → feedbackBoardRouter   (mount at '/feedback')
//   - feedback-board.admin.controller.ts  → feedbackBoardAdminRouter (mount at '/admin')
//   - changelog.controller.ts             → changelogRouter       (mount at '/changelog')
import { Hono } from 'hono';
import {
  type AdminNoteDto,
  type AdminPatchPostDto,
  type ChangelogEntryDto,
  type ChangelogPatchDto,
  type CreateCommentDto,
  type CreatePostDto,
  feedbackBoardService,
  type QueryPostsDto,
} from '../services/feedback-board.service.ts';
import { bool, jsonBody, num, str } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

/** ParseIntPipe equivalent — 400 on a non-numeric path param. */
function parseIntParam(raw: string | undefined, name: string): number {
  const n = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(n)) {
    throw new HttpError(400, `Validation failed (numeric string is expected)`);
  }
  return n;
}

// ========================================================================
// Public / authed board — mount at '/feedback'
// ========================================================================
export const feedbackBoardRouter = new Hono();

// Static sub-paths before the dynamic posts/:ref routes so they aren't shadowed.
feedbackBoardRouter.get('/meta', async (c) => c.json(await feedbackBoardService.meta()));

feedbackBoardRouter.get('/roadmap', async (c) => c.json(await feedbackBoardService.roadmap()));

feedbackBoardRouter.get('/similar', async (c) => {
  const q = c.req.query('q');
  if (q === undefined || q.length < 1 || q.length > 200) {
    throw new HttpError(422, 'q is invalid');
  }
  return c.json(await feedbackBoardService.similar(q));
});

feedbackBoardRouter.get('/posts', async (c) => {
  const sort = c.req.query('sort');
  if (sort !== undefined && sort !== 'top' && sort !== 'new') {
    throw new HttpError(422, 'sort must be one of top, new');
  }
  const qText = c.req.query('q');
  if (qText !== undefined && qText.length > 200) throw new HttpError(422, 'q is too long');
  const dto: QueryPostsDto = {
    sort: sort as 'top' | 'new' | undefined,
    status: c.req.query('status'),
    category: c.req.query('category'),
    q: qText,
    cursor: c.req.query('cursor'),
  };
  return c.json(await feedbackBoardService.list(dto));
});

feedbackBoardRouter.post('/posts', async (c) => {
  const b = await jsonBody(c.req);
  const dto: CreatePostDto = {
    title: str(b, 'title', true, { min: 3, max: 140 })!,
    body: str(b, 'body', false, { max: 5000 }),
    category: str(b, 'category', false),
  };
  return c.json(await feedbackBoardService.createPost(dto), 201);
});

feedbackBoardRouter.get('/posts/:ref', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.detail(ref));
});

feedbackBoardRouter.post('/posts/:ref/vote', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.vote(ref), 201);
});

feedbackBoardRouter.delete('/posts/:ref/vote', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.unvote(ref));
});

feedbackBoardRouter.post('/posts/:ref/comments', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  const b = await jsonBody(c.req);
  const dto: CreateCommentDto = {
    body: str(b, 'body', true, { min: 1, max: 5000 })!,
    parent_id: num(b, 'parent_id', false, { int: true, min: 1 }),
  };
  return c.json(await feedbackBoardService.addComment(ref, dto), 201);
});

feedbackBoardRouter.post('/posts/:ref/subscribe', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.subscribe(ref), 201);
});

feedbackBoardRouter.delete('/posts/:ref/subscribe', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.unsubscribe(ref));
});

// ========================================================================
// Admin surface — mount at '/admin'
// ========================================================================
export const feedbackBoardAdminRouter = new Hono();

feedbackBoardAdminRouter.patch('/feedback/posts/:ref', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  const b = await jsonBody(c.req);
  const dto: AdminPatchPostDto = {
    status: str(b, 'status', false),
    category: str(b, 'category', false),
    pinned: bool(b, 'pinned', false),
    locked: bool(b, 'locked', false),
    approved: bool(b, 'approved', false),
    note: str(b, 'note', false, { max: 2000 }),
  };
  return c.json(await feedbackBoardService.adminPatchPost(ref, dto));
});

// Removes the post and everything under it. See `adminDeletePost` for what
// happens to a changelog entry that came from it.
feedbackBoardAdminRouter.delete('/feedback/posts/:ref', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  return c.json(await feedbackBoardService.adminDeletePost(ref));
});

feedbackBoardAdminRouter.post('/feedback/posts/:ref/notes', async (c) => {
  const ref = parseIntParam(c.req.param('ref'), 'ref');
  const b = await jsonBody(c.req);
  const dto: AdminNoteDto = {
    body: str(b, 'body', true, { min: 1, max: 5000 })!,
  };
  return c.json(await feedbackBoardService.adminAddNote(ref, dto), 201);
});

feedbackBoardAdminRouter.get('/feedback/queue', async (c) => c.json(await feedbackBoardService.adminQueue()));

feedbackBoardAdminRouter.post('/changelog', async (c) => {
  const b = await jsonBody(c.req);
  const dto: ChangelogEntryDto = {
    title: str(b, 'title', true, { min: 1, max: 200 })!,
    body: str(b, 'body', true, { min: 1, max: 20000 })!,
    source_ref: num(b, 'source_ref', false, { int: true, min: 1 }),
    publish: bool(b, 'publish', false),
  };
  return c.json(await feedbackBoardService.adminCreateChangelog(dto), 201);
});

feedbackBoardAdminRouter.patch('/changelog/:id', async (c) => {
  const id = parseIntParam(c.req.param('id'), 'id');
  const b = await jsonBody(c.req);
  const dto: ChangelogPatchDto = {
    title: str(b, 'title', false, { min: 1, max: 200 }),
    body: str(b, 'body', false, { min: 1, max: 20000 }),
    publish: bool(b, 'publish', false),
  };
  return c.json(await feedbackBoardService.adminPatchChangelog(id, dto));
});

// ========================================================================
// Public changelog ("What's new") — mount at '/changelog'
// ========================================================================
export const changelogRouter = new Hono();

changelogRouter.get('/', async (c) => c.json(await feedbackBoardService.changelog()));
