import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../../common/request-context';
import { RateDto, FeedbackDto, TelemetryDto } from './dto/feedback.dto';

/**
 * §2.12 — ratings, free-text feedback, and consent-gated telemetry. Fire-and-
 * forget: accepted, logged, and (if SLACK_WEBHOOK_URL is set) ratings/feedback
 * are forwarded to Slack. No dedicated table yet — persistence/warehouse is a
 * later enhancement; this makes the endpoints functional for the app.
 */
@Injectable()
export class FeedbackService {
  private readonly log = new Logger('Feedback');

  constructor(private readonly rc: RequestContext) {}

  async rate(dto: RateDto) {
    this.log.log(`rating=${dto.rating} user=${this.rc.userId} comment=${dto.comment ?? ''}`);
    await this.toSlack(`⭐️ ${dto.rating}/5 from ${this.rc.userId}${dto.comment ? `: ${dto.comment}` : ''}`);
    return { status: 'received' };
  }

  async feedback(dto: FeedbackDto) {
    this.log.log(`feedback user=${this.rc.userId}: ${dto.text}`);
    await this.toSlack(`📝 Feedback from ${this.rc.userId}: ${dto.text}`);
    return { status: 'received' };
  }

  /** Consent-gated client telemetry. PII-minimized: we don't store raw events
   *  here — just acknowledge the count. Wire to a warehouse later (§4.8). */
  telemetry(dto: TelemetryDto) {
    return { accepted: dto.events?.length ?? 0 };
  }

  private async toSlack(text: string) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;
    try {
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    } catch {
      /* fire-and-forget */
    }
  }
}
