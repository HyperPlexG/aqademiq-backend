// Redis failures say why (_shared/redis.ts).
//
// On 26 Oct 2026 every Redis call in the day's logs was "unreachable", so rate
// limits, idempotency and the hard-tier spend cap were all off, and nothing
// recorded whether the cause was a timeout, a wrong token or a missing database.

import { assertEquals } from 'jsr:@std/assert@1';

// redis.ts reads its configuration when it is first loaded, so set it before
// importing, under a specifier of its own.
Deno.env.set('UPSTASH_REDIS_REST_URL', 'https://redis.test');
Deno.env.set('UPSTASH_REDIS_REST_TOKEN', 'test-token');
Deno.env.set('REDIS_TIMEOUT_MS', '30');
const redis = await import(new URL('../_shared/redis.ts', import.meta.url).href + '?failure-test');
// Read once at load; clear them so no other test file sees a configured Redis.
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'REDIS_TIMEOUT_MS']) Deno.env.delete(k);

async function withFetch(fake: typeof fetch, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try { await fn(); } finally { globalThis.fetch = original; }
}

Deno.test('a rejected token is reported with its status', () =>
  withFetch(() => Promise.resolve(new Response('{"error":"WRONGPASS invalid password"}', { status: 401 })), async () => {
    assertEquals(await redis.cacheGet('k'), null);
    assertEquals(redis.lastRedisFailure(), 'HTTP 401: {"error":"WRONGPASS invalid password"}');
  }));

Deno.test('a call that outlives REDIS_TIMEOUT_MS is reported as a timeout', () =>
  withFetch((_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }), async () => {
    assertEquals(await redis.cacheGet('k'), null);
    assertEquals(redis.lastRedisFailure(), 'timed out after 30ms');
  }));

Deno.test('a network error is reported as one', () =>
  withFetch(() => Promise.reject(new TypeError('dns error: no such host')), async () => {
    assertEquals(await redis.cacheGet('k'), null);
    assertEquals(redis.lastRedisFailure(), 'network error: dns error: no such host');
  }));

Deno.test('a successful call clears the failure', () =>
  withFetch(() => Promise.resolve(new Response('{"result":"v"}', { status: 200 })), async () => {
    assertEquals(await redis.cacheGet('k'), 'v');
    assertEquals(redis.lastRedisFailure(), '');
  }));
