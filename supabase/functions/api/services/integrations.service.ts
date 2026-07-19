// §2.12 — external calendar import (ICS subscriptions + Google Calendar).
// Port of src/features/integrations/integrations.service.ts (+ ics-parser.ts and
// the encryptSecret/isEncryptionConfigured helpers from src/infra/crypto.util.ts,
// inlined here because no _shared crypto helper exists — see final report).
// Uses the raw client (prismaBase) exactly like the Nest source, which passes
// user_id explicitly on every query.
import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { env } from '../../_shared/env.ts';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS = 1_000;

export interface ImportIcsDto {
  url?: string;
  ics?: string;
  calendar_email?: string;
}

export interface GoogleOauthCallbackDto {
  code: string;
  redirect_uri?: string;
}

// ---- inlined ICS parser (port of ics-parser.ts) --------------------------

interface IcsEvent {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

function parseIcs(raw: string): IcsEvent[] {
  // Unfold: a CRLF (or LF) followed by a space or tab continues the prior line.
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: IcsEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (trimmed === 'END:VEVENT') {
      if (cur) {
        const ev = buildEvent(cur);
        if (ev) events.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const namePart = trimmed.slice(0, colon);
    const value = trimmed.slice(colon + 1);
    const [name, ...paramParts] = namePart.split(';');
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    cur[name.toUpperCase()] = { value, params };
  }

  return events;
}

function buildEvent(fields: Record<string, { value: string; params: Record<string, string> }>): IcsEvent | null {
  const dtstart = fields['DTSTART'];
  if (!dtstart) return null;
  const start = parseIcsDate(dtstart.value);
  if (!start) return null;

  const allDay = /^\d{8}$/.test(dtstart.value) || dtstart.params['VALUE'] === 'DATE';
  const end = fields['DTEND'] ? parseIcsDate(fields['DTEND'].value) : null;

  return {
    uid: fields['UID']?.value?.trim() || `${dtstart.value}-${fields['SUMMARY']?.value ?? ''}`.slice(0, 500),
    title: unescapeText(fields['SUMMARY']?.value ?? '(untitled)').slice(0, 500),
    description: fields['DESCRIPTION'] ? unescapeText(fields['DESCRIPTION'].value) : null,
    location: fields['LOCATION'] ? unescapeText(fields['LOCATION'].value) : null,
    start,
    end,
    allDay,
  };
}

function parseIcsDate(value: string): Date | null {
  const v = value.trim();
  // Date only: YYYYMMDD
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Date-time (UTC 'Z' or floating): YYYYMMDDTHHMMSS[Z]
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(v);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// ---- inlined secret encryption (port of crypto.util.ts) ------------------
// AES-256-GCM with a 32-byte key via DATA_ENCRYPTION_KEY (base64 or hex).
// Output format: `v1:<iv>:<tag>:<ct>` (all base64url). Never log the plaintext.
const CRYPTO_PREFIX = 'v1';

function loadKey(): Buffer | null {
  const raw = env('DATA_ENCRYPTION_KEY');
  if (!raw) return null;
  let key: Buffer;
  try {
    key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
  return key.length === 32 ? key : null;
}

function isEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) throw new Error('DATA_ENCRYPTION_KEY is not configured (need a 32-byte base64/hex key)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [CRYPTO_PREFIX, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
}

// ---- Google Calendar mapping --------------------------------------------

interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

function mapGoogleEvent(g: GoogleEvent): IcsEvent | null {
  const startRaw = g.start?.dateTime ?? g.start?.date;
  if (!startRaw || !g.id) return null;
  const allDay = !g.start?.dateTime;
  const start = new Date(startRaw);
  if (isNaN(start.getTime())) return null;
  const endRaw = g.end?.dateTime ?? g.end?.date;
  const end = endRaw ? new Date(endRaw) : null;
  return {
    uid: g.id,
    title: (g.summary ?? '(untitled)').slice(0, 500),
    description: g.description ?? null,
    location: g.location ?? null,
    start,
    end: end && !isNaN(end.getTime()) ? end : null,
    allDay,
  };
}

// ---- shared persistence --------------------------------------------------

async function upsertConnection(
  provider: string,
  data: {
    calendar_email: string | null;
    access_token_enc: string;
    refresh_token_enc?: string | null;
    token_expires_at?: Date | null;
  },
) {
  const existing = await prismaBase().calendarConnection.findFirst({
    where: { user_id: RequestContext.userId, provider, calendar_email: data.calendar_email },
  });
  if (existing) {
    return prismaBase().calendarConnection.update({
      where: { id: existing.id },
      data: { ...data, is_active: true, updated_at: new Date() },
    });
  }
  return prismaBase().calendarConnection.create({
    data: { user_id: RequestContext.userId, provider, is_active: true, ...data },
  });
}

async function importEvents(connectionId: string, events: IcsEvent[]): Promise<number> {
  let count = 0;
  for (const ev of events) {
    if (!ev.uid) continue;
    // The deployed schema has no unique on (calendar_connection_id,
    // external_event_id), so emulate an upsert with find-then-write.
    const existing = await prismaBase().calendarEvent.findFirst({
      where: { calendar_connection_id: connectionId, external_event_id: ev.uid },
      select: { id: true },
    });
    if (existing) {
      await prismaBase().calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: ev.title,
          description: ev.description,
          starts_at: ev.start,
          ends_at: ev.end,
          is_all_day: ev.allDay,
          sync_status: 'synced',
          synced_at: new Date(),
          updated_at: new Date(),
        },
      });
    } else {
      await prismaBase().calendarEvent.create({
        data: {
          calendar_connection_id: connectionId,
          user_id: RequestContext.userId,
          external_event_id: ev.uid,
          title: ev.title,
          description: ev.description,
          starts_at: ev.start,
          ends_at: ev.end,
          is_all_day: ev.allDay,
          event_source: 'external',
          sync_status: 'synced',
          metadata: ev.location ? { location: ev.location } : {},
          synced_at: new Date(),
        },
      });
    }
    count += 1;
  }
  return count;
}

// ---- ICS fetch (with SSRF guard) ----------------------------------------

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } catch {
    throw new HttpError(400, 'Calendar request failed or timed out');
  } finally {
    clearTimeout(timer);
  }
}

/** Normalize webcal→https and reject internal/link-local hosts (SSRF). */
function safeCalendarUrl(raw: string): string {
  let normalized = raw.trim();
  if (normalized.startsWith('webcal://')) normalized = 'https://' + normalized.slice('webcal://'.length);
  let u: URL;
  try { u = new URL(normalized); } catch { throw new HttpError(400, 'Invalid calendar URL'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new HttpError(400, 'Calendar URL must be http(s)');
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' ||
    host.startsWith('[');
  if (blocked) throw new HttpError(400, 'Calendar URL host is not allowed');
  return u.toString();
}

async function fetchIcs(rawUrl: string): Promise<string> {
  const url = safeCalendarUrl(rawUrl);
  const res = await timedFetch(url, { headers: { Accept: 'text/calendar,*/*' } });
  if (!res.ok) throw new HttpError(400, `Could not fetch ICS (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_ICS_BYTES) {
    throw new HttpError(400, 'ICS file is too large');
  }
  return buf.toString('utf8');
}

// ---- Google Calendar -----------------------------------------------------

async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await timedFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new HttpError(422, 'Google token exchange failed');
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!json.access_token) throw new HttpError(422, 'Google token exchange returned no access token');
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in };
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await timedFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

async function fetchGoogleEvents(accessToken: string): Promise<IcsEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await timedFetch(`${GOOGLE_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(422, 'Could not read Google Calendar events');
  const json = (await res.json()) as { items?: GoogleEvent[] };
  return (json.items ?? []).map(mapGoogleEvent).filter((e): e is IcsEvent => e !== null);
}

export const integrationsService = {
  /**
   * POST /integrations/calendar/ics — import events from an ICS subscription
   * URL or raw ICS text. Idempotent per (connection, external UID).
   */
  async importIcs(dto: ImportIcsDto) {
    let icsText = dto.ics ?? '';
    let source = dto.calendar_email ?? null;

    if (!icsText && dto.url) {
      icsText = await fetchIcs(dto.url);
      source = source ?? dto.url;
    }
    if (!icsText.trim()) {
      throw new HttpError(400, 'Provide an ICS `url` or raw `ics` text');
    }

    const events = parseIcs(icsText).slice(0, MAX_EVENTS);
    const connection = await upsertConnection('ics', {
      calendar_email: dto.calendar_email ?? null,
      access_token_enc: '', // ICS subscriptions carry no OAuth token
    });
    const imported = await importEvents(connection.id, events);

    return {
      status: 'imported',
      provider: 'ics',
      connection_id: connection.id,
      source,
      imported,
      total_parsed: events.length,
    };
  },

  /**
   * POST /integrations/google/oauth/callback — exchange the OAuth
   * authorization code for tokens, then import upcoming Google Calendar events.
   * Config-gated: requires GOOGLE_OAUTH_CLIENT_ID/SECRET and a data-encryption
   * key (Apple Calendar import is handled on-device, not here).
   */
  async googleOauth(dto: GoogleOauthCallbackDto) {
    const clientId = env('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = env('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new HttpError(
        422,
        'Google Calendar import is not configured (set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)',
      );
    }
    if (!isEncryptionConfigured()) {
      throw new HttpError(
        422,
        'Google Calendar import requires DATA_ENCRYPTION_KEY (32-byte base64/hex) to store tokens at rest',
      );
    }

    const tokens = await exchangeGoogleCode(dto.code, dto.redirect_uri ?? 'postmessage', clientId, clientSecret);
    const email = await fetchGoogleEmail(tokens.access_token);
    const rawEvents = await fetchGoogleEvents(tokens.access_token);

    const connection = await upsertConnection('google', {
      calendar_email: email,
      access_token_enc: encryptSecret(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    });
    const imported = await importEvents(connection.id, rawEvents);

    return {
      status: 'imported',
      provider: 'google',
      connection_id: connection.id,
      calendar_email: email,
      imported,
      total_parsed: rawEvents.length,
    };
  },
};
