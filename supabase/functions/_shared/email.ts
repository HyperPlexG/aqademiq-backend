// §7 transactional email via Resend REST. Port of src/infra/email.service.ts.
// Never throws; returns 'skipped_no_provider' when EMAIL_PROVIDER_API_KEY is absent.
//
// This module does NOT send auth email. Signup verification, password reset and
// change-email codes are minted and delivered by Supabase Auth (GoTrue), which
// has its own SMTP configuration in the dashboard — nothing here is on that
// path. An OTP sender used to live here, from before auth moved to Supabase on
// 2026-07-18; it had no callers left and was removed, because code that looks
// like it delivers signup codes but cannot is worse than no code at all. If
// auth email needs changing, the setting is Authentication -> SMTP, not this file.
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
}

export const email = {
  async sendNotification(to: string, subject: string, bodyText: string): Promise<EmailResult> {
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;"><h1 style="margin:0 0 16px;font-size:20px;">Aqademiq</h1><h2 style="margin:0 0 16px;font-size:16px;color:#6b5cf0;">${esc(subject)}</h2><p style="margin:0;font-size:15px;line-height:1.5;color:#444;">${esc(bodyText)}</p></div></body></html>`;
    return send(to, subject, html, bodyText);
  },
};
