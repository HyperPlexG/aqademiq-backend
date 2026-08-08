// §4.5 push delivery. Port of src/infra/push.service.ts.
//
// FCM on edge requires an SA-JWT→OAuth exchange (like _shared/vertex.ts) using
// the FCM_SA_* secrets, then a call to the FCM HTTP v1 API. Until those secrets
// are provisioned this degrades to 'skipped_no_provider' (push is optional at
// launch per the deployment runbook). APNs is not yet wired.
import { env } from './env.ts';
import { SignJWT, importPKCS8 } from 'jose';

export interface PushResult {
  status: 'sent' | 'failed' | 'skipped_no_provider' | 'unsupported_provider';
  provider_message_id?: string;
  error?: string;
}

// Edge uses discrete secrets rather than a mounted service-account file.
const FCM_PROJECT = () => env('FCM_PROJECT_ID');
const FCM_CLIENT_EMAIL = () => env('FCM_CLIENT_EMAIL');
const FCM_PRIVATE_KEY = () => env('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');

export function fcmConfigured(): boolean {
  return Boolean(FCM_PROJECT() && FCM_CLIENT_EMAIL() && FCM_PRIVATE_KEY());
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function fcmAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const key = await importPKCS8(FCM_PRIVATE_KEY()!, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(FCM_CLIENT_EMAIL()!)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed (${res.status})`);
  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

async function sendFcm(token: string, title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
  if (!fcmConfigured()) return { status: 'skipped_no_provider' };
  try {
    const at = await fcmAccessToken();
    // FCM v1 requires every `data` value to be a string, or the send 400s.
    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : undefined;
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT()}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${at}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: stringData,
          // Explicit iOS alert config: a high-priority alert with sound so the
          // banner reliably shows on APNs (the bare `notification` block relies
          // on FCM's default aps mapping, which some iOS versions render silently).
          apns: {
            // apns-push-type is required on iOS 13+; without it APNs may defer or
            // drop the push. priority 10 = deliver immediately (5 would let iOS
            // batch it for power-saving, which showed up as ~20-minute delays).
            headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
            payload: { aps: { alert: { title, body }, sound: 'default', badge: 1 } },
          },
          android: {
            priority: 'high',
            notification: { channel_id: 'aqademiq_default' },
          },
        },
      }),
    });
    if (!res.ok) return { status: 'failed', error: `${res.status}: ${await res.text()}` };
    const json = await res.json() as { name?: string };
    return { status: 'sent', provider_message_id: json.name };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

export const push = {
  /** Send to one device token, routed by provider. Never throws. */
  async send(provider: string, token: string, title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
    if (provider === 'fcm') return sendFcm(token, title, body, data);
    if (provider === 'apns') return { status: 'unsupported_provider', error: 'APNs sender not yet wired' };
    return { status: 'unsupported_provider', error: `unknown provider: ${provider}` };
  },
};
