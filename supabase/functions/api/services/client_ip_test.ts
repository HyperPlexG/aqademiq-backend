// Which header decides a caller's rate-limit bucket.
//
// This is a security test, not a plumbing one. The bucket key is the only thing
// standing between one client and unlimited requests, so if a *client-supplied*
// header can change it, the limiter is off for anyone who reads the source.
//
// `cf-connecting-ip` and `x-real-ip` are written by the Cloudflare edge in front
// of every Supabase Function; a client that sends them has its values discarded.
// `x-forwarded-for` is the opposite: the edge appends to whatever arrived, so its
// leftmost entry is attacker-controlled text.
//
// Measured over 1,882 production requests: x-real-ip present on all of them,
// never empty, 9 distinct values, and identical to cf-connecting-ip every time.
// x-forwarded-for was never sent at all.

import { assertEquals } from 'jsr:@std/assert@1';
import type { Context } from 'hono';
import { clientIp } from '../../_shared/redis.ts';

/** Minimal stand-in for the parts of Hono's Context that clientIp touches. */
function ctx(headers: Record<string, string>): Context {
  return {
    req: { header: (name: string) => headers[name.toLowerCase()] },
  } as unknown as Context;
}

Deno.test('the edge-set header wins over a forged x-forwarded-for', () => {
  // The attack: vary x-forwarded-for per request to land in a fresh bucket every
  // time. It must not work, with or without TRUST_PROXY.
  const ip = clientIp(ctx({
    'cf-connecting-ip': '203.0.113.7',
    'x-real-ip': '203.0.113.7',
    'x-forwarded-for': '1.2.3.4, 203.0.113.7',
  }));
  assertEquals(ip, '203.0.113.7');
});

Deno.test('x-real-ip is used when cf-connecting-ip is absent', () => {
  assertEquals(clientIp(ctx({ 'x-real-ip': '198.51.100.9' })), '198.51.100.9');
});

Deno.test('TRUST_PROXY cannot promote x-forwarded-for over an edge header', () => {
  // The artifact under review recommended setting TRUST_PROXY=1. On Supabase
  // that would have been a downgrade, so the ordering must not be overridable.
  Deno.env.set('TRUST_PROXY', '1');
  try {
    const ip = clientIp(ctx({
      'x-real-ip': '203.0.113.7',
      'x-forwarded-for': '1.2.3.4',
    }));
    assertEquals(ip, '203.0.113.7');
  } finally {
    Deno.env.delete('TRUST_PROXY');
  }
});

Deno.test('x-forwarded-for is still honoured behind a non-Cloudflare proxy', () => {
  // The escape hatch has to keep working for a deployment that terminates
  // somewhere else — it just must never outrank an edge-set header.
  Deno.env.set('TRUST_PROXY', '1');
  try {
    assertEquals(clientIp(ctx({ 'x-forwarded-for': '192.0.2.5, 10.0.0.1' })), '192.0.2.5');
  } finally {
    Deno.env.delete('TRUST_PROXY');
  }
});

Deno.test('x-forwarded-for is ignored when TRUST_PROXY is unset', () => {
  assertEquals(clientIp(ctx({ 'x-forwarded-for': '192.0.2.5' })), 'unknown');
});

Deno.test('a request with no usable header shares the "unknown" bucket', () => {
  // Everyone unidentifiable shares one bucket. That is the safe direction: it
  // over-limits strangers rather than handing each of them a private allowance.
  assertEquals(clientIp(ctx({})), 'unknown');
});
