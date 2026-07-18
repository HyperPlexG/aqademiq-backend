import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { encryptSecret, isEncryptionConfigured } from '../../infra/crypto.util';
import { parseIcs, type IcsEvent } from './ics-parser';
import { GoogleOauthCallbackDto, ImportIcsDto } from './dto/integrations.dto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ICS_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS = 1_000;

/** §2.12 — external calendar import (ICS subscriptions + Google Calendar). */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  /**
   * POST /integrations/calendar/ics — import events from an ICS subscription
   * URL or raw ICS text. Idempotent per (connection, external UID).
   */
  async importIcs(dto: ImportIcsDto) {
    let icsText = dto.ics ?? '';
    let source = dto.calendar_email ?? null;

    if (!icsText && dto.url) {
      icsText = await this.fetchIcs(dto.url);
      source = source ?? dto.url;
    }
    if (!icsText.trim()) {
      throw new BadRequestException('Provide an ICS `url` or raw `ics` text');
    }

    const events = parseIcs(icsText).slice(0, MAX_EVENTS);
    const connection = await this.upsertConnection('ics', {
      calendar_email: dto.calendar_email ?? null,
      access_token_enc: '', // ICS subscriptions carry no OAuth token
    });
    const imported = await this.importEvents(connection.id, events);

    return {
      status: 'imported',
      provider: 'ics',
      connection_id: connection.id,
      source,
      imported,
      total_parsed: events.length,
    };
  }

  /**
   * POST /integrations/google/oauth/callback — exchange the OAuth
   * authorization code for tokens, then import upcoming Google Calendar events.
   * Config-gated: requires GOOGLE_OAUTH_CLIENT_ID/SECRET and a data-encryption
   * key (Apple Calendar import is handled on-device, not here).
   */
  async googleOauth(dto: GoogleOauthCallbackDto) {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new UnprocessableEntityException(
        'Google Calendar import is not configured (set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)',
      );
    }
    if (!isEncryptionConfigured()) {
      throw new UnprocessableEntityException(
        'Google Calendar import requires DATA_ENCRYPTION_KEY (32-byte base64/hex) to store tokens at rest',
      );
    }

    const tokens = await this.exchangeGoogleCode(dto.code, dto.redirect_uri ?? 'postmessage', clientId, clientSecret);
    const email = await this.fetchGoogleEmail(tokens.access_token);
    const rawEvents = await this.fetchGoogleEvents(tokens.access_token);

    const connection = await this.upsertConnection('google', {
      calendar_email: email,
      access_token_enc: encryptSecret(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
    });
    const imported = await this.importEvents(connection.id, rawEvents);

    return {
      status: 'imported',
      provider: 'google',
      connection_id: connection.id,
      calendar_email: email,
      imported,
      total_parsed: rawEvents.length,
    };
  }

  // ---- shared persistence -------------------------------------------------

  private async upsertConnection(
    provider: string,
    data: {
      calendar_email: string | null;
      access_token_enc: string;
      refresh_token_enc?: string | null;
      token_expires_at?: Date | null;
    },
  ) {
    const existing = await this.prisma.calendarConnection.findFirst({
      where: { user_id: this.rc.userId, provider, calendar_email: data.calendar_email },
    });
    if (existing) {
      return this.prisma.calendarConnection.update({
        where: { id: existing.id },
        data: { ...data, is_active: true, updated_at: new Date() },
      });
    }
    return this.prisma.calendarConnection.create({
      data: { user_id: this.rc.userId, provider, is_active: true, ...data },
    });
  }

  private async importEvents(connectionId: string, events: IcsEvent[]): Promise<number> {
    let count = 0;
    for (const ev of events) {
      if (!ev.uid) continue;
      // The deployed schema has no unique on (calendar_connection_id,
      // external_event_id), so emulate an upsert with find-then-write.
      const existing = await this.prisma.calendarEvent.findFirst({
        where: { calendar_connection_id: connectionId, external_event_id: ev.uid },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.calendarEvent.update({
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
        await this.prisma.calendarEvent.create({
          data: {
            calendar_connection_id: connectionId,
            user_id: this.rc.userId,
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

  // ---- ICS fetch (with SSRF guard) ---------------------------------------

  private async fetchIcs(rawUrl: string): Promise<string> {
    const url = this.safeCalendarUrl(rawUrl);
    const res = await this.timedFetch(url, { headers: { Accept: 'text/calendar,*/*' } });
    if (!res.ok) throw new BadRequestException(`Could not fetch ICS (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_ICS_BYTES) {
      throw new BadRequestException('ICS file is too large');
    }
    return buf.toString('utf8');
  }

  /** Normalize webcal→https and reject internal/link-local hosts (SSRF). */
  private safeCalendarUrl(raw: string): string {
    let normalized = raw.trim();
    if (normalized.startsWith('webcal://')) normalized = 'https://' + normalized.slice('webcal://'.length);
    let u: URL;
    try { u = new URL(normalized); } catch { throw new BadRequestException('Invalid calendar URL'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new BadRequestException('Calendar URL must be http(s)');
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
    if (blocked) throw new BadRequestException('Calendar URL host is not allowed');
    return u.toString();
  }

  // ---- Google Calendar ---------------------------------------------------

  private async exchangeGoogleCode(
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
    const res = await this.timedFetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new UnprocessableEntityException('Google token exchange failed');
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!json.access_token) throw new UnprocessableEntityException('Google token exchange returned no access token');
    return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in };
  }

  private async fetchGoogleEmail(accessToken: string): Promise<string | null> {
    try {
      const res = await this.timedFetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { email?: string };
      return json.email ?? null;
    } catch {
      return null;
    }
  }

  private async fetchGoogleEvents(accessToken: string): Promise<IcsEvent[]> {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    const res = await this.timedFetch(`${GOOGLE_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnprocessableEntityException('Could not read Google Calendar events');
    const json = (await res.json()) as { items?: GoogleEvent[] };
    return (json.items ?? []).map(mapGoogleEvent).filter((e): e is IcsEvent => e !== null);
  }

  private async timedFetch(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
    } catch {
      throw new BadRequestException('Calendar request failed or timed out');
    } finally {
      clearTimeout(timer);
    }
  }
}

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
