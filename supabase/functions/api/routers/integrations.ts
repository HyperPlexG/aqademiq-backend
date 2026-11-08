// §2.12 — /v1/integrations. Port of integrations.controller.ts.
import { Hono } from 'hono';
import { integrationsService, type GoogleOauthCallbackDto, type ImportIcsDto } from '../services/integrations.service.ts';
import { calendarImportService } from '../services/calendar-import.service.ts';
import { parseCheckRequest, parseImportRequest } from '../services/import_plan.ts';
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

// v2 — Calendar import / Reminder import (Settings → Preferences).
// The app reads the student's calendars and reminders on the device, shows
// them for review, and sends the picked items here; each becomes a task.
// Re-sending an item that is already in the plan is a no-op, so importing the
// same calendar again only adds what is new. See services/import_plan.ts.
integrationsRouter.post('/import', async (c) => {
  const b = await jsonBody(c.req);
  return c.json(await calendarImportService.importItems(parseImportRequest(b)), 201);
});

// Which of these items are already in the plan, and which did the student
// import and then delete. A read, but POST because the ids travel in the body.
integrationsRouter.post('/import/check', async (c) => {
  const b = await jsonBody(c.req);
  return c.json(await calendarImportService.check(parseCheckRequest(b)));
});
