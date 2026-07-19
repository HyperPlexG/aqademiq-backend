// §2.12 — ratings, free-text feedback, and consent-gated telemetry.
// Port of src/features/feedback/feedback.service.ts.
// Fire-and-forget: accepted, logged, and (if SLACK_WEBHOOK_URL is set)
// ratings/feedback are forwarded to Slack. No dedicated table yet.
import { RequestContext } from '../../_shared/context.ts';
import { env } from '../../_shared/env.ts';

export interface RateDto {
  rating: number;
  comment?: string;
}

export interface FeedbackDto {
  text: string;
}

export interface TelemetryDto {
  events: Record<string, unknown>[];
}

async function toSlack(text: string): Promise<void> {
  const url = env('SLACK_WEBHOOK_URL');
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    /* fire-and-forget */
  }
}

export const feedbackService = {
  async rate(dto: RateDto) {
    console.log(`rating=${dto.rating} user=${RequestContext.userId} comment=${dto.comment ?? ''}`);
    await toSlack(`⭐️ ${dto.rating}/5 from ${RequestContext.userId}${dto.comment ? `: ${dto.comment}` : ''}`);
    return { status: 'received' };
  },

  async feedback(dto: FeedbackDto) {
    console.log(`feedback user=${RequestContext.userId}: ${dto.text}`);
    await toSlack(`📝 Feedback from ${RequestContext.userId}: ${dto.text}`);
    return { status: 'received' };
  },

  /** Consent-gated client telemetry. PII-minimized: we don't store raw events
   *  here — just acknowledge the count. Wire to a warehouse later (§4.8). */
  telemetry(dto: TelemetryDto) {
    return { accepted: dto.events?.length ?? 0 };
  },
};
