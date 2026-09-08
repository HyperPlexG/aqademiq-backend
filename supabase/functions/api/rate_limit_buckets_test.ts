// Who a rate limit is charged to.
//
// The bug this guards against is not a security hole — it is an event that
// rate-limits itself. Keying solely on the client address meant every phone
// behind one venue's NAT shared a single budget, so a room of students throttled
// each other. Measured on production, one ordinary user peaked at 46 requests a
// minute against a 200/min address budget: roughly four people and the room was
// full.
//
// So the tests that matter are the ones asserting that two callers from the SAME
// address get SEPARATE budgets, and that the address ceiling still exists behind
// them — because a token is not scarce and anyone can mint junk ones.

import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { rateBuckets } from '../_shared/redis.ts';

const WINDOW = 29_400_000;
const VENUE = '203.0.113.7';

const scopes = (b: ReturnType<typeof rateBuckets>) => b.map((x) => x.scope).sort();
const of = (b: ReturnType<typeof rateBuckets>, scope: string) => {
  const found = b.find((x) => x.scope === scope);
  assert(found, `no ${scope} bucket`);
  return found;
};

Deno.test('two students on one venue WiFi do not share a budget', () => {
  const a = rateBuckets('hash-of-alices-token', VENUE, WINDOW);
  const b = rateBuckets('hash-of-bobs-token', VENUE, WINDOW);

  // The whole point. Same address, different people, different counters.
  assertNotEquals(of(a, 'user').key, of(b, 'user').key);

  // And each gets the full per-person allowance, not a share of one.
  assertEquals(of(a, 'user').limit, of(b, 'user').limit);
});

Deno.test('the address ceiling still applies to authenticated traffic', () => {
  // Without this a junk-token flood from one address is unbounded, because every
  // forged token opens a fresh budget of its own.
  const b = rateBuckets('some-token-hash', VENUE, WINDOW);
  assertEquals(scopes(b), ['ip', 'user']);
  assert(of(b, 'ip').limit > of(b, 'user').limit,
    'the backstop must sit above the per-person budget, or it caps individuals instead');
});

Deno.test('the address ceiling is generous enough for a real room', () => {
  // 46 req/min was the measured peak for one heavy user. A backstop that a
  // plausible venue can reach would reintroduce exactly the bug being fixed.
  const ipLimit = of(rateBuckets('t', VENUE, WINDOW), 'ip').limit;
  assert(ipLimit >= 46 * 50,
    `an address ceiling of ${ipLimit} throttles a room of 50 active students`);
});

Deno.test('unauthenticated requests fall back to the address, on a tighter budget', () => {
  const b = rateBuckets(null, VENUE, WINDOW);
  assertEquals(scopes(b), ['anon']);
  assert(of(b, 'anon').limit < of(rateBuckets('t', VENUE, WINDOW), 'ip').limit,
    'anonymous traffic should not get the authenticated backstop');
});

Deno.test('one caller moving between networks keeps one budget', () => {
  // Wi-Fi to mobile data mid-signup must not hand out a second allowance.
  const wifi = rateBuckets('same-token', VENUE, WINDOW);
  const cellular = rateBuckets('same-token', '198.51.100.22', WINDOW);
  assertEquals(of(wifi, 'user').key, of(cellular, 'user').key);
  assertNotEquals(of(wifi, 'ip').key, of(cellular, 'ip').key);
});

Deno.test('counters are scoped to their window, so a lost EXPIRE cannot lock anyone out', () => {
  // EXPIRE is best-effort. Because the window is part of the key, failing to set
  // it leaks a key rather than carrying a full counter into the next minute.
  const now = rateBuckets('t', VENUE, WINDOW);
  const next = rateBuckets('t', VENUE, WINDOW + 1);
  for (const scope of ['user', 'ip']) {
    assertNotEquals(of(now, scope).key, of(next, scope).key);
  }
});

Deno.test('the address bucket is always first, so INCR results line up', () => {
  // The middleware zips pipeline results back onto this array by index.
  assertEquals(rateBuckets('t', VENUE, WINDOW)[0].scope, 'ip');
  assertEquals(rateBuckets(null, VENUE, WINDOW)[0].scope, 'anon');
});

Deno.test('an unknown address still buckets, rather than escaping the limiter', () => {
  // clientIp returns 'unknown' when no edge header is present.
  const b = rateBuckets(null, 'unknown', WINDOW);
  assertEquals(b.length, 1);
  assert(of(b, 'anon').key.includes('unknown'));
});
