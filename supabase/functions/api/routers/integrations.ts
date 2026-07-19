// §2.12 — /v1/integrations. Port of integrations.controller.ts.
import { Hono } from 'hono';
import { integrationsService, type GoogleOauthCallbackDto, type ImportIcsDto } from '../services/integrations.service.ts';
import { jsonBody, str } from '../../_shared/validate.ts';

export const integrationsRouter = new Hono();

// Import an ICS subscription (URL or raw text). Supply either `url` OR `ics`.
integrationsRouter.post('/calendar/ics', async (c) => {
  const b = await jsonBody(c.req);
  // ValidateIf mirrors class-validator: `url` required only when `ics` absent, and
  // vice versa. The service also 400s when neither yields usable ICS text.
  const hasIcs = typeof b['ics'] === 'string' && (b['ics'] as string).length > 0;
  const hasUrl = typeof b['url'] === 'string' && (b['url'] as string).length > 0;
  const dto: ImportIcsDto = {
    url: str(b, 'url', !hasIcs, { max: 2048 }),
    ics: str(b, 'ics', !hasUrl, { max: 1_000_000 }),
    calendar_email: str(b, 'calendar_email', false, { max: 255 }),
  };
  return c.json(await integrationsService.importIcs(dto), 201);
});

// Exchange a Google OAuth code and import upcoming Calendar events.
integrationsRouter.post('/google/oauth/callback', async (c) => {
  const b = await jsonBody(c.req);
  const dto: GoogleOauthCallbackDto = {
    code: str(b, 'code', true, { max: 2048 })!,
    redirect_uri: str(b, 'redirect_uri', false, { max: 2048 }),
  };
  return c.json(await integrationsService.googleOauth(dto), 201);
});
