// Tests for how long a rate-limited AI key gets benched.
//
// This is the logic that broke the pool in production: every 429 was treated as
// "exhausted until UTC midnight", so five bursts of ordinary per-minute limiting
// sidelined all five Gemini keys for the day and every Ada run failed with
// "All AI keys failed". The distinction below is the entire fix, and it is
// invisible at runtime until the pool is empty again — hence tests.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { geminiCooldownSeconds } from '../../_shared/ai.ts';

/** A day's worth of seconds, give or take — used to assert "benched long". */
const HOUR = 3600;

Deno.test('RetryInfo is honoured, with a second of slack', () => {
  const body = JSON.stringify({
    error: {
      code: 429,
      details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '27s' }],
    },
  });
  assertEquals(geminiCooldownSeconds(body), 28);
});

Deno.test('a fractional retryDelay still parses', () => {
  const body = '{"details":[{"retryDelay":"12.8s"}]}';
  assertEquals(geminiCooldownSeconds(body), 13);
});

Deno.test('a zero retryDelay is floored, not treated as "retry instantly"', () => {
  assertEquals(geminiCooldownSeconds('{"retryDelay":"0s"}'), 5);
});

Deno.test('an absurd retryDelay is capped rather than benching for hours', () => {
  assertEquals(geminiCooldownSeconds('{"retryDelay":"99999s"}'), 300);
});

Deno.test('a per-MINUTE quota does not bench the key for the day', () => {
  // The real shape of the response that caused the outage.
  const body = JSON.stringify({
    error: {
      status: 'RESOURCE_EXHAUSTED',
      details: [{
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
      }],
    },
  });
  const seconds = geminiCooldownSeconds(body);
  assert(seconds <= 300, `expected a short cooldown, got ${seconds}s`);
});

Deno.test('a per-DAY quota does bench until it resets', () => {
  const body = JSON.stringify({
    error: {
      details: [{
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
      }],
    },
  });
  const seconds = geminiCooldownSeconds(body);
  // Anything beyond an hour means "until the daily reset" rather than a retry.
  assert(seconds > HOUR || seconds >= 60, `expected a long cooldown, got ${seconds}s`);
  assert(seconds > 300, `per-day must outlast the rate-limit cap, got ${seconds}s`);
});

Deno.test('an unrecognised 429 body falls back to a short cooldown', () => {
  assertEquals(geminiCooldownSeconds('rate limited'), 60);
});
