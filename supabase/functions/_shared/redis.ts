// Upstash Redis (REST) + rate-limit and idempotency middleware — ports of
// src/common/middleware/{rate-limit,idempotency}.middleware.ts.
//
// Everything fails OPEN: if Upstash env is absent or a call errors, requests
// proceed (availability > strictness for a study app), matching the originals.

import type { Context, Next } from 'hono';
import { env } from './env.ts';

const REST_URL = env('UPSTASH_REDIS_REST_URL');
const REST_TOKEN = env('UPSTASH_REDIS_REST_TOKEN');
export const redisEnabled = Boolean(REST_URL && REST_TOKEN);

const OP_TIMEOUT_MS = 200;

/** Run one Redis command via the Upstash REST API. Returns null on any failure. */
async function cmd(args: (string | number)[]): Promise<unknown | null> {
  if (!redisEnabled) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), OP_TIMEOUT_MS);
    const res = await fetch(REST_URL!, {
      method: 'POST',
      headers: { authorization: `Bearer ${REST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

/** Generic cache read. Returns null if disabled/missing/error. */
export async function cacheGet(key: string): Promise<string | null> {
  const v = await cmd(['GET', key]);
  return typeof v === 'string' ? v : null;
}

/** Generic cache write with TTL seconds. No-op if disabled. */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  await cmd(['SET', key, value, 'EX', ttlSeconds]);
}

/** Delete a cache key. No-op if disabled. */
export async function cacheDel(key: string): Promise<void> {
  await cmd(['DEL', key]);
}

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 20;
const GENERAL_LIMIT = 200;

/** Fixed-window per-IP rate limit. Auth-ish paths get a tighter budget. */
export function rateLimit() {
  return async (c: Context, next: Next) => {
    if (!redisEnabled) return next();
    const path = c.req.path;
    const isAuth = path.includes('/auth/');
    const limit = isAuth ? AUTH_LIMIT : GENERAL_LIMIT;
    const ip = clientIp(c);
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const key = `rl:${isAuth ? 'auth' : 'gen'}:${ip}:${window}`;

    const count = await cmd(['INCR', key]);
    if (typeof count === 'number') {
      if (count === 1) await cmd(['EXPIRE', key, WINDOW_SECONDS]);
      if (count > limit) {
        const ttl = await cmd(['TTL', key]);
        c.header('Retry-After', String(typeof ttl === 'number' && ttl > 0 ? ttl : WINDOW_SECONDS));
        return c.json({ status_code: 429, error: 'TOO_MANY_REQUESTS', message: 'Too many requests', path, timestamp: new Date().toISOString() }, 429);
      }
    }
    return next();
  };
}

function clientIp(c: Context): string {
  if (env('TRUST_PROXY') === '1') {
    const xff = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (xff) return xff;
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

const IDEM_TTL_SECONDS = 24 * 60 * 60;
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Idempotency-Key replay guard for mutating requests, scoped per bearer token. */
export function idempotency() {
  return async (c: Context, next: Next) => {
    const key = c.req.header('Idempotency-Key');
    if (!redisEnabled || !key || !MUTATING.has(c.req.method)) return next();

    const auth = c.req.header('authorization') ?? 'anon';
    const scope = (await sha256Hex(`${auth}:${key}`)).slice(0, 32);
    const redisKey = `idem:${scope}`;

    const cached = await cmd(['GET', redisKey]);
    if (typeof cached === 'string') {
      try {
        const { status, body } = JSON.parse(cached);
        c.header('Idempotent-Replay', 'true');
        return c.json(body, status);
      } catch { /* fall through and re-run */ }
    }

    await next();

    const status = c.res.status;
    if (status >= 200 && status < 300) {
      try {
        const body = await c.res.clone().json();
        await cmd(['SET', redisKey, JSON.stringify({ status, body }), 'EX', IDEM_TTL_SECONDS, 'NX']);
      } catch { /* non-JSON or clone failure — skip caching */ }
    }
  };
}
