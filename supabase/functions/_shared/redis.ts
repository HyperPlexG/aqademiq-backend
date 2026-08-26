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

/**
 * Add to a counter, setting its TTL on first write. Returns the new total, or
 * null if Redis is disabled or unreachable.
 *
 * INCRBY creates the key at 0 when it is missing, but attaches no expiry — so
 * the TTL is applied on the write that created it. Without that, a per-day
 * counter would live forever and today's ceiling would follow the user into
 * tomorrow.
 */
export async function cacheIncrBy(key: string, by: number, ttlSeconds: number): Promise<number | null> {
  const total = await cmd(['INCRBY', key, by]);
  if (typeof total !== 'number') return null;
  if (total === by) await cmd(['EXPIRE', key, ttlSeconds]);
  return total;
}

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 20;
const GENERAL_LIMIT = 200;

/**
 * Announce, once per isolate, that the limiter is not actually limiting.
 *
 * Failing open is the right call for a study app — Upstash being unreachable is
 * a poor reason to lock everyone out. What was wrong is that it failed open in
 * *silence*: with `UPSTASH_*` unset, every request sailed through and the logs
 * looked identical to a healthy deployment enforcing limits. The first sign of
 * trouble would have been the bill, or an outage. One line per isolate is enough
 * to make the difference visible without flooding the log.
 */
let warnedDisabled = false;
function warnOnceDisabled() {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.warn('[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN unset — rate limiting and idempotency are DISABLED (failing open)');
}

/** Fixed-window per-IP rate limit. Auth-ish paths get a tighter budget. */
export function rateLimit() {
  return async (c: Context, next: Next) => {
    if (!redisEnabled) {
      warnOnceDisabled();
      return next();
    }
    const path = c.req.path;
    const isAuth = path.includes('/auth/');
    const limit = isAuth ? AUTH_LIMIT : GENERAL_LIMIT;
    const ip = clientIp(c);
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const key = `rl:${isAuth ? 'auth' : 'gen'}:${ip}:${window}`;

    const count = await cmd(['INCR', key]);
    if (typeof count !== 'number') {
      // Configured but not answering: distinct from "never configured", and the
      // one that tends to happen under exactly the load limits exist for.
      console.warn(`[ratelimit] Redis unreachable — allowing ${c.req.method} ${path} unlimited`);
    }
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

/**
 * The address to bucket a request under.
 *
 * Order matters, and it is the opposite of the usual advice. `cf-connecting-ip`
 * and `x-real-ip` are written by the Cloudflare edge that fronts every Supabase
 * Function; whatever a client sends under those names is overwritten, so they
 * cannot be forged. `x-forwarded-for` is a client-supplied list that the edge
 * only appends to, which makes its leftmost entry an attacker-chosen string —
 * exactly the value that must NOT decide someone's rate-limit bucket, because
 * varying it per request grants unlimited requests.
 *
 * Measured against 1,882 production requests: `x-real-ip` was present on every
 * one, was never empty, held 9 distinct addresses, and equalled
 * `cf-connecting-ip` every single time. `x-forwarded-for` was not sent at all.
 *
 * So `TRUST_PROXY` is now strictly an escape hatch for running behind some
 * *other* proxy that terminates before Cloudflare. Leave it unset on Supabase:
 * switching it on here would move the bucket key from an unforgeable header to a
 * forgeable one, turning the rate limiter off for anyone who noticed.
 */
export function clientIp(c: Context): string {
  const edge = c.req.header('cf-connecting-ip') ?? c.req.header('x-real-ip');
  if (edge) return edge;
  if (env('TRUST_PROXY') === '1') {
    const xff = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (xff) return xff;
  }
  return 'unknown';
}

const IDEM_TTL_SECONDS = 24 * 60 * 60;
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
/** How long a claim is held before we assume the handler died mid-flight. */
const IDEM_LOCK_TTL_SECONDS = 120;
/** Sentinel stored while a handler owns the key but has not produced a body yet. */
const IDEM_IN_FLIGHT = '__in_flight__';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Idempotency-Key replay guard for mutating requests, scoped per bearer token.
 *
 * The key is *claimed* before the handler runs, not only cached after it. The
 * previous read-then-run-then-cache order left a window as wide as the handler
 * itself: a duplicate arriving while the first was still working saw an empty
 * cache and ran the whole thing again. For a cheap CRUD write that is merely
 * wasteful; for `POST /ada/.../messages` it means a second full agent run, and
 * the provider quota that run consumes is spent whether or not anyone reads the
 * answer.
 *
 * Fails open exactly as before: with Upstash absent or erroring, `cmd` returns
 * null throughout and every request simply proceeds.
 */
export function idempotency() {
  return async (c: Context, next: Next) => {
    const key = c.req.header('Idempotency-Key');
    if (!redisEnabled || !key || !MUTATING.has(c.req.method)) return next();

    const auth = c.req.header('authorization') ?? 'anon';
    const scope = (await sha256Hex(`${auth}:${key}`)).slice(0, 32);
    const redisKey = `idem:${scope}`;

    // "OK" = we own the key. null = either someone else owns it or Redis is
    // unreachable; the GET below tells those apart, and an unreadable result
    // falls through to running the handler (fail-open).
    const claimed = await cmd(['SET', redisKey, IDEM_IN_FLIGHT, 'EX', IDEM_LOCK_TTL_SECONDS, 'NX']);
    if (claimed !== 'OK') {
      const cached = await cmd(['GET', redisKey]);
      if (cached === IDEM_IN_FLIGHT) {
        return c.json({
          status_code: 409,
          error: 'REQUEST_IN_PROGRESS',
          message: 'This request is already being processed.',
          path: c.req.path,
          timestamp: new Date().toISOString(),
        }, 409);
      }
      if (typeof cached === 'string') {
        try {
          const { status, body } = JSON.parse(cached);
          c.header('Idempotent-Replay', 'true');
          return c.json(body, status);
        } catch { /* unreadable — fall through and re-run */ }
      }
    }

    try {
      await next();
    } catch (e) {
      // Release the claim: an exception is not a result worth replaying, and
      // holding the key would block the user's retry for the full lock TTL.
      await cmd(['DEL', redisKey]);
      throw e;
    }

    const status = c.res.status;
    if (status >= 200 && status < 300) {
      try {
        const body = await c.res.clone().json();
        // Plain SET, not NX — we hold the claim and are replacing our own
        // sentinel, which an NX write would refuse to overwrite.
        await cmd(['SET', redisKey, JSON.stringify({ status, body }), 'EX', IDEM_TTL_SECONDS]);
      } catch {
        await cmd(['DEL', redisKey]); // non-JSON body: nothing to replay later
      }
    } else {
      await cmd(['DEL', redisKey]); // a failure should be retryable
    }
  };
}
