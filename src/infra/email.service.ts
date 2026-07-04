import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface EmailResult {
  status: 'sent' | 'failed' | 'skipped_no_provider';
  provider_message_id?: string;
  error?: string;
}

interface OtpTemplate {
  subject: string;
  intro: string;
}

/**
 * §7 transactional email via Resend. Delivers the 6-digit OTPs minted by
 * AuthService.issueOtp() (signup / login / password reset / change email).
 *
 * Unconfigured-safe: when EMAIL_PROVIDER_API_KEY is absent, isConfigured() is
 * false and sendOtp() returns 'skipped_no_provider' instead of attempting a
 * send. This keeps local dev working off the console/dev_code path with no key.
 *
 * Never throws — callers treat email as best-effort so a provider outage cannot
 * crash an auth flow.
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

  /** Send a one-time code email for the given purpose. Never throws. */
  async sendOtp(email: string, purpose: string, code: string): Promise<EmailResult> {
    if (!this.isConfigured()) return { status: 'skipped_no_provider' };

    const tpl = this.template(purpose);
    try {
      const { data, error } = await this.resend().emails.send({
        from: this.from,
        to: email,
        subject: tpl.subject,
        html: this.html(tpl, code),
        text: this.text(tpl, code),
      });
      if (error) {
        this.logger.error(`OTP email to ${email} failed: ${error.message}`);
        return { status: 'failed', error: error.message };
      }
      return { status: 'sent', provider_message_id: data?.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`OTP email to ${email} threw: ${message}`);
      return { status: 'failed', error: message };
    }
  }

  private resend(): Resend {
    if (!this.client) this.client = new Resend(this.apiKey);
    return this.client;
  }

  private template(purpose: string): OtpTemplate {
    switch (purpose) {
      case 'signup':
        return { subject: 'Verify your Aqademiq account', intro: 'Use this code to verify your email and finish creating your account.' };
      case 'login':
        return { subject: 'Your Aqademiq sign-in code', intro: 'Use this code to sign in to your account.' };
      case 'password_reset':
        return { subject: 'Reset your Aqademiq password', intro: 'Use this code to reset your password.' };
      case 'change_email':
        return { subject: 'Confirm your new Aqademiq email', intro: 'Use this code to confirm your new email address.' };
      default:
        return { subject: 'Your Aqademiq verification code', intro: 'Use this code to continue.' };
    }
  }

  private text(tpl: OtpTemplate, code: string): string {
    return `${tpl.intro}\n\nYour code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request it, you can safely ignore this email.`;
  }

  private html(tpl: OtpTemplate, code: string): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Aqademiq</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#444;">${tpl.intro}</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f1f3f5;border-radius:8px;">${code}</div>
      <p style="margin:24px 0 0;font-size:13px;color:#888;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;
  }
}
