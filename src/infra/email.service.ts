import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface EmailResult {
  status: 'sent' | 'failed' | 'skipped_no_provider';
  provider_message_id?: string;
  error?: string;
}

/**
 * §7 transactional email via Resend. Today that means feedback-board
 * notifications; it is NOT on the auth path.
 *
 * Signup verification, password reset and change-email codes are minted and
 * delivered by Supabase Auth (GoTrue), configured under Authentication -> SMTP
 * in the dashboard. This service used to send those OTPs, back when AuthService
 * issued them; auth moved to Supabase on 2026-07-18 and the sender was left
 * behind with no callers. It has been removed, because a method that looks like
 * it delivers signup codes but never runs is worse than no method at all.
 *
 * Unconfigured-safe: when EMAIL_PROVIDER_API_KEY is absent, isConfigured() is
 * false and sends return 'skipped_no_provider' rather than attempting delivery,
 * so local dev works with no key.
 *
 * Never throws — callers treat email as best-effort so a provider outage cannot
 * crash a request.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client?: Resend;
  private readonly apiKey = process.env.EMAIL_PROVIDER_API_KEY ?? '';
  private readonly from = process.env.EMAIL_FROM ?? 'no-reply@aqademiq.app';

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Send a generic transactional notification (e.g. feedback board updates).
   *  Never throws; skipped when no provider is configured. */
  async sendNotification(email: string, subject: string, bodyText: string): Promise<EmailResult> {
    if (!this.isConfigured()) return { status: 'skipped_no_provider' };
    try {
      const { data, error } = await this.resend().emails.send({
        from: this.from,
        to: email,
        subject,
        html: this.notificationHtml(subject, bodyText),
        text: bodyText,
      });
      if (error) {
        this.logger.error(`Notification email to ${email} failed: ${error.message}`);
        return { status: 'failed', error: error.message };
      }
      return { status: 'sent', provider_message_id: data?.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Notification email to ${email} threw: ${message}`);
      return { status: 'failed', error: message };
    }
  }

  private notificationHtml(subject: string, bodyText: string): string {
    const safe = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Aqademiq</h1>
      <h2 style="margin:0 0 16px;font-size:16px;color:#6b5cf0;">${subject}</h2>
      <p style="margin:0;font-size:15px;line-height:1.5;color:#444;">${safe}</p>
    </div>
  </body>
</html>`;
  }

  private resend(): Resend {
    if (!this.client) this.client = new Resend(this.apiKey);
    return this.client;
  }
}
