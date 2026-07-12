import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'node:fs';

export interface PushResult {
  status: 'sent' | 'failed' | 'skipped_no_provider' | 'unsupported_provider';
  provider_message_id?: string;
  error?: string;
}

/**
 * §4.5 push delivery. FCM (Android) via firebase-admin is implemented and
 * config-safe (no-op until FCM_SERVICE_ACCOUNT_PATH is set). APNs (iOS) needs an
 * HTTP/2 client library (not yet a dependency) — flagged below.
 *
 * The per-tz cron sweep + BullMQ delayed-job worker that *schedules* reminders
 * is a separate worker process (see queue.service); this service is the unified
 * sender it ultimately calls.
 */
@Injectable()
export class PushService {
  private fcmApp?: admin.app.App;

  isFcmConfigured(): boolean {
    return Boolean(process.env.FCM_SERVICE_ACCOUNT_PATH);
  }

  /** Send to one device token, routed by provider. Never throws. */
  async send(provider: string, token: string, title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
    if (provider === 'fcm') return this.sendFcm(token, title, body, data);
    if (provider === 'apns') return { status: 'unsupported_provider', error: 'APNs sender not yet wired (needs an HTTP/2 APNs client)' };
    return { status: 'unsupported_provider', error: `unknown provider: ${provider}` };
  }

  private async sendFcm(token: string, title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
    if (!this.isFcmConfigured()) return { status: 'skipped_no_provider' };
    try {
      const id = await admin.messaging(this.fcm()).send({ token, notification: { title, body }, data });
      return { status: 'sent', provider_message_id: id };
    } catch (e) {
      return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  }

  private fcm(): admin.app.App {
    if (!this.fcmApp) {
      const path = process.env.FCM_SERVICE_ACCOUNT_PATH as string;
      const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
      this.fcmApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, 'aqademiq-fcm');
    }
    return this.fcmApp;
  }
}
