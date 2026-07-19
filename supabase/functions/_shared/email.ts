// §7 transactional email via Resend REST. Port of src/infra/email.service.ts.
// Never throws; returns 'skipped_no_provider' when EMAIL_PROVIDER_API_KEY is absent.
import { env } from './env.ts';

export interface EmailResult {
  status: 'sent' | 'failed' | 'skipped_no_provider';
  provider_message_id?: string;
  error?: string;
}

const apiKey = () => env('EMAIL_PROVIDER_API_KEY') ?? '';
const from = () => env('EMAIL_FROM') ?? 'no-reply@aqademiq.app';

export function emailConfigured(): boolean {
  return Boolean(apiKey());
}

async function send(to: string, subject: string, html: string, text: string): Promise<EmailResult> {
  if (!emailConfigured()) return { status: 'skipped_no_provider' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: from(), to, subject, html, text }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Email to ${to} failed (${res.status}): ${err}`);
      return { status: 'failed', error: err };
    }
    const data = await res.json();
    return { status: 'sent', provider_message_id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Email to ${to} threw: ${message}`);
    return { status: 'failed', error: message };
  }
}

function otpTemplate(purpose: string): { subject: string; intro: string } {
  switch (purpose) {
    case 'signup': return { subject: 'Verify your Aqademiq account', intro: 'Use this code to verify your email and finish creating your account.' };
    case 'login': return { subject: 'Your Aqademiq sign-in code', intro: 'Use this code to sign in to your account.' };
    case 'password_reset': return { subject: 'Reset your Aqademiq password', intro: 'Use this code to reset your password.' };
    case 'change_email': return { subject: 'Confirm your new Aqademiq email', intro: 'Use this code to confirm your new email address.' };
    default: return { subject: 'Your Aqademiq verification code', intro: 'Use this code to continue.' };
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
}

export const email = {
  async sendOtp(to: string, purpose: string, code: string): Promise<EmailResult> {
    const tpl = otpTemplate(purpose);
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;"><h1 style="margin:0 0 16px;font-size:20px;">Aqademiq</h1><p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#444;">${tpl.intro}</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f1f3f5;border-radius:8px;">${code}</div><p style="margin:24px 0 0;font-size:13px;color:#888;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p></div></body></html>`;
    const text = `${tpl.intro}\n\nYour code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request it, you can safely ignore this email.`;
    return send(to, tpl.subject, html, text);
  },

  async sendNotification(to: string, subject: string, bodyText: string): Promise<EmailResult> {
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;"><h1 style="margin:0 0 16px;font-size:20px;">Aqademiq</h1><h2 style="margin:0 0 16px;font-size:16px;color:#6b5cf0;">${esc(subject)}</h2><p style="margin:0;font-size:15px;line-height:1.5;color:#444;">${esc(bodyText)}</p></div></body></html>`;
    return send(to, subject, html, bodyText);
  },
};
