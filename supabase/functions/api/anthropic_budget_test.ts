// Claude through Anthropic's API, inside the monthly budget (_shared/anthropic.ts).
//
// The guarantee that matters is money: Ada must not spend past the cap, and any
// doubt (no ledger, a dropped connection) must count against the budget rather
// than for it. The ledger and the API are faked here; the SQL behind the ledger
// is tested against real Postgres in ai_spend_sql_test.ts.

import { assert, assertAlmostEquals, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import Anthropic from '@anthropic-ai/sdk';
import {
  anthropicBody,
  AnthropicUnavailable,
  budgetPeriodStart,
  costUsd,
  type Ledger,
  priceOf,
  type ReserveResult,
  secondsToNextPeriod,
  sendAnthropic,
  worstCaseUsd,
} from '../_shared/anthropic.ts';

Deno.test('prices: the three tiers, Haiku past 100K, and an unknown model at the top rate', () => {
  assertEquals(priceOf('claude-haiku-5-5'), { input: 0.10, output: 0.50, cacheRead: 0.01 });
  assertEquals(priceOf('claude-sonnet-5-5').output, 10);
  assertEquals(priceOf('claude-opus-5').output, 25);
  assertEquals(priceOf('claude-haiku-5-5', 150_000).input, 0.50);
  assertEquals(priceOf('claude-something-new').output, 50);
});

Deno.test('a response is priced from its usage, cache reads and writes included', () => {
  // Opus 5: 1,000 fresh in, 8,000 written to cache, 20,000 read from it, 2,000 out.
  const usd = costUsd(['claude-opus-5'], {
    input_tokens: 1000,
    cache_creation_input_tokens: 8000,
    cache_read_input_tokens: 20000,
    output_tokens: 2000,
  });
  // 1000×5 + 8000×5×1.25 + 20000×0.5 + 2000×25, per million.
  assertAlmostEquals(usd, (5000 + 50000 + 10000 + 50000) / 1e6, 1e-12);
  // A fallback that ran on a dearer model is priced at the dearer one.
  assert(costUsd(['claude-haiku-5-5', 'claude-opus-4-8'], { output_tokens: 1000 }) > costUsd(['claude-haiku-5-5'], { output_tokens: 1000 }));
});

Deno.test('the reservation is the worst case: every max token, the prompt at the cache-write price', () => {
  // 30,000 characters ≈ 10,000 tokens; 16,000 max tokens on Opus 5.
  assertAlmostEquals(worstCaseUsd('claude-opus-5', 30_000, 16_000), (10_000 * 5 * 1.25 + 16_000 * 25) / 1e6, 1e-12);
});

Deno.test('the budget period starts on the reset day, and rolls over the year', () => {
  assertEquals(budgetPeriodStart(new Date('2026-11-07T10:00:00Z'), 1), '2026-11-01');
  assertEquals(budgetPeriodStart(new Date('2026-11-07T10:00:00Z'), 15), '2026-10-15');
  assertEquals(budgetPeriodStart(new Date('2026-11-15T00:00:00Z'), 15), '2026-11-15');
  assertEquals(budgetPeriodStart(new Date('2027-01-03T00:00:00Z'), 5), '2026-12-05');
  assertEquals(secondsToNextPeriod(new Date('2026-11-30T23:00:00Z'), 1), 3600);
});

Deno.test('the request caches tools and system, and only Sonnet/Opus ask for a refusal fallback', () => {
  const body = { system: 'You are Ada.', messages: [], max_tokens: 16000 };
  const opus = anthropicBody('claude-opus-5', body);
  assertEquals(opus.system, [{ type: 'text', text: 'You are Ada.', cache_control: { type: 'ephemeral' } }]);
  assertEquals(opus.cache_control, { type: 'ephemeral' });
  assertEquals(opus.fallbacks, 'default');
  assertEquals(opus.betas, ['server-side-fallback-2026-07-01']);
  const haiku = anthropicBody('claude-haiku-5-5', body);
  assertEquals('fallbacks' in haiku, false);
  assertEquals('betas' in haiku, false);
});

/** An in-memory ledger with the SQL's semantics. */
function fakeLedger(opts: { cap?: number; userCap?: number; spent?: number; broken?: boolean } = {}) {
  const state = { total: opts.spent ?? 0, user: 0, reserves: 0 };
  const ledger: Ledger = {
    reserve(usd, _userId): Promise<ReserveResult> {
      if (opts.broken) return Promise.reject(new Error('connection refused'));
      if (state.total + usd > (opts.cap ?? 99)) return Promise.resolve('monthly_cap');
      if (opts.userCap !== undefined && state.user + usd > opts.userCap) return Promise.resolve('user_cap');
      state.total += usd;
      state.user += usd;
      state.reserves++;
      return Promise.resolve('ok');
    },
    settle(delta) {
      state.total = Math.max(0, state.total + delta);
      state.user = Math.max(0, state.user + delta);
      return Promise.resolve();
    },
  };
  return { ledger, state };
}

const BODY = { system: 'You are Ada.', messages: [{ role: 'user', content: 'hi' }], max_tokens: 16000 };
const opts = (ledger: Ledger, create: (b: Record<string, unknown>) => Promise<unknown>) => ({
  signal: AbortSignal.timeout(1000),
  tier: 'middle' as const,
  ledger,
  create,
  now: new Date('2026-11-07T10:00:00Z'),
});

Deno.test('a successful call is settled to what it really cost', async () => {
  const { ledger, state } = fakeLedger();
  const res = await sendAnthropic('claude-sonnet-5-5', BODY, opts(ledger, () =>
    Promise.resolve({
      model: 'claude-sonnet-5-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hello' }],
      usage: { input_tokens: 1000, output_tokens: 500 },
    })));
  assertEquals(res.content[0].text, 'Hello');
  assertAlmostEquals(state.total, (1000 * 2 + 500 * 10) / 1e6, 1e-12);
});

Deno.test('past the monthly cap Claude is not called, and is benched', async () => {
  const { ledger } = fakeLedger({ cap: 99, spent: 98.99 });
  let called = false;
  const err = await assertRejects(
    () => sendAnthropic('claude-opus-5', BODY, opts(ledger, () => { called = true; return Promise.resolve({}); })),
    AnthropicUnavailable,
    'monthly budget reached',
  );
  assertEquals(called, false);
  assertEquals((err as AnthropicUnavailable).cooldownSeconds, 600);
});

Deno.test("one student's daily share skips Claude for that call only — no bench", async () => {
  const { ledger } = fakeLedger({ userCap: 0.0001 });
  const err = await assertRejects(() => sendAnthropic('claude-sonnet-5-5', BODY, opts(ledger, () => Promise.resolve({}))));
  assertEquals(err instanceof AnthropicUnavailable, false);
});

Deno.test('no ledger, no spending: an unreachable ledger benches Claude', async () => {
  const { ledger } = fakeLedger({ broken: true });
  let called = false;
  await assertRejects(
    () => sendAnthropic('claude-haiku-5-5', BODY, opts(ledger, () => { called = true; return Promise.resolve({}); })),
    AnthropicUnavailable,
    'ledger unreachable',
  );
  assertEquals(called, false);
});

Deno.test('402 (credit used up) releases the reservation and benches Claude until the next period', async () => {
  const { ledger, state } = fakeLedger();
  const err = await assertRejects(
    () => sendAnthropic('claude-sonnet-5-5', BODY, opts(ledger, () =>
      Promise.reject(Anthropic.APIError.generate(402, { type: 'error', error: { type: 'billing_error', message: 'credit balance too low' } }, 'credit balance too low', new Headers())))),
    AnthropicUnavailable,
  );
  assertEquals(state.total, 0);
  assertEquals((err as AnthropicUnavailable).cooldownSeconds, secondsToNextPeriod(new Date('2026-11-07T10:00:00Z')));
});

Deno.test('429 honours retry-after and releases the reservation', async () => {
  const { ledger, state } = fakeLedger();
  const err = await assertRejects(
    () => sendAnthropic('claude-sonnet-5-5', BODY, opts(ledger, () =>
      Promise.reject(Anthropic.APIError.generate(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 'slow down', new Headers({ 'retry-after': '12' }))))),
    AnthropicUnavailable,
  );
  assertEquals(state.total, 0);
  assertEquals((err as AnthropicUnavailable).cooldownSeconds, 13);
});

Deno.test('a dropped connection keeps the reservation: it may have been billed', async () => {
  const { ledger, state } = fakeLedger();
  await assertRejects(() => sendAnthropic('claude-opus-5', BODY, opts(ledger, () => Promise.reject(new TypeError('network error')))));
  assert(state.total > 0.39, `reservation kept, got ${state.total}`);
});
