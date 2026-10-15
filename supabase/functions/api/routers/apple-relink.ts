// /v1/me/apple-relink — keep Sign in with Apple pointing at the right account
// after the app moved Apple developer teams. See services/apple-relink.service.ts.
import { Hono } from 'hono';
import { appleRelinkService } from '../services/apple-relink.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

export const appleRelinkRouter = new Hono();

// GET /me/apple-relink — { needed }: should the app ask this user to confirm?
appleRelinkRouter.get('/', async (c) => c.json(await appleRelinkService.status()));

// POST /me/apple-relink { identity_token, nonce } — { status }.
appleRelinkRouter.post('/', async (c) => {
  const b = await jsonBody(c.req);
  const identityToken = str(b, 'identity_token', true, { min: 20, max: 8192 })!;
  const nonce = str(b, 'nonce', true, { min: 8, max: 256 })!;
  return c.json(await appleRelinkService.relink(identityToken, nonce));
});
