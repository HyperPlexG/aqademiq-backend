// §2.12 — root-level feedback routes. Port of feedback.controller.ts (@Controller('/')).
import { Hono } from 'hono';
import { feedbackService, type FeedbackDto, type RateDto, type TelemetryDto } from '../services/feedback.service.ts';
import { jsonBody, num, str } from '../../_shared/validate.ts';
import { HttpError } from '../../_shared/http.ts';

export const feedbackRouter = new Hono();

feedbackRouter.post('/ratings', async (c) => {
  const b = await jsonBody(c.req);
  const dto: RateDto = {
    rating: num(b, 'rating', true, { int: true, min: 1, max: 5 })!,
    comment: str(b, 'comment', false, { max: 2000 }),
  };
  return c.json(await feedbackService.rate(dto), 201);
});

feedbackRouter.post('/feedback', async (c) => {
  const b = await jsonBody(c.req);
  const dto: FeedbackDto = {
    text: str(b, 'text', true, { min: 1, max: 5000 })!,
  };
  return c.json(await feedbackService.feedback(dto), 201);
});

feedbackRouter.post('/telemetry/events', async (c) => {
  const b = await jsonBody(c.req);
  const events = b.events;
  if (!Array.isArray(events)) throw new HttpError(422, 'events must be an array');
  for (const e of events) {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      throw new HttpError(422, 'each event must be an object');
    }
  }
  const dto: TelemetryDto = { events: events as Record<string, unknown>[] };
  return c.json(feedbackService.telemetry(dto), 201);
});
