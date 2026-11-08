// Claude through Anthropic's own API — Ada's first choice, inside a monthly cap.
//
// The account gets a monthly API credit. Ada spends at most
// ANTHROPIC_MONTHLY_BUDGET_USD of it (default $99) and, past that, the pool in
// ai.ts falls through to Gemini on Vertex until the next period. Each tier has
// its own model (agent/tiers.ts decides the tier):
//
//   easy   → Claude Haiku 5.5   ($0.10 / $0.50 per 1M tokens in / out)
//   middle → Claude Sonnet 5.5  ($2 / $10)
//   hard   → Claude Opus 5.5    ($4 / $20; in fast mode $8 / $40)
//
// Tuned for speed, not to a time budget: every tier thinks at `low` effort, and
// Opus runs in fast mode (up to ~2.5× faster output, at twice the price — the
// budget prices it). If fast mode is refused or rate-limited, the same call is
// retried at standard speed rather than leaving Claude.
//
// The cap is enforced in Postgres (migration 20261107130000_ai_spend.sql), not
// Redis: Redis fails open, which is fine for a rate limit and not for money.
// Every call RESERVES its worst case before it is sent and SETTLES to the real
// cost from the response, so concurrent calls cannot overshoot and a call that
// dies in flight is still counted. If the ledger cannot be reached, Claude is
// skipped (fail closed) and Gemini answers.
//
// A per-student daily share (ANTHROPIC_USER_DAILY_USD) keeps one heavy user from
// spending everyone's month.
//
// Request shape: ai.ts builds the Messages body (claudeRequest — the same one
// Claude on Vertex uses); this file adds prompt caching and, on Sonnet/Opus,
// the server-side refusal fallback, then reads the answer with claudeResult.

import Anthropic from '@anthropic-ai/sdk';
import { env } from './env.ts';
import { prismaBase } from './prisma.ts';
import { RequestContext } from './context.ts';

export type ClaudeTier = 'easy' | 'middle' | 'hard';

const TIER_ENV: Record<ClaudeTier, string> = { easy: 'EASY', middle: 'MIDDLE', hard: 'HARD' };

export const DEFAULT_ANTHROPIC_MODELS: Record<ClaudeTier, string> = {
  easy: 'claude-haiku-5-5',
  middle: 'claude-sonnet-5-5',
  hard: 'claude-opus-5-5',
};

/**
 * How hard each tier thinks. Thinking is always on for these models (Opus 5.5
 * cannot turn it off) and every thinking token is time the student waits, so
 * effort is the speed lever: `low` everywhere, for the fastest replies. The
 * newest models at `low` match older ones at higher effort; if the hard tier's
 * answers ever fall short, raise ANTHROPIC_HARD_EFFORT to `medium` first.
 */
export const DEFAULT_ANTHROPIC_EFFORT: Record<ClaudeTier, string> = {
  easy: 'low',
  middle: 'low',
  hard: 'low',
};

/** Models with fast mode (`speed: "fast"`, Claude API only, research preview). */
const FAST_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8']);

/**
 * Fast mode for this tier's model: on for the hard tier by default
 * (ANTHROPIC_HARD_FAST=off turns it off), off for the others unless their
 * secret says `on` — and only ever for a model that has it.
 */
export function anthropicFast(tier: ClaudeTier = 'middle', model = anthropicModel(tier)): boolean {
  if (!FAST_MODELS.has(model)) return false;
  const v = (env(`ANTHROPIC_${TIER_ENV[tier]}_FAST`) ?? '').trim().toLowerCase();
  return v ? v === 'on' : tier === 'hard';
}

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export function anthropicConfigured(): boolean {
  if ((env('ANTHROPIC_DIRECT') ?? '').trim().toLowerCase() === 'off') return false;
  return !!env('ANTHROPIC_API_KEY');
}

export function anthropicModel(tier: ClaudeTier = 'middle'): string {
  return env(`ANTHROPIC_${TIER_ENV[tier]}_MODEL`)?.trim() || DEFAULT_ANTHROPIC_MODELS[tier];
}

export function anthropicEffort(tier: ClaudeTier = 'middle'): string {
  const v = (env(`ANTHROPIC_${TIER_ENV[tier]}_EFFORT`) ?? '').trim().toLowerCase();
  return EFFORTS.includes(v) ? v : DEFAULT_ANTHROPIC_EFFORT[tier];
}

// ---- prices --------------------------------------------------------------

/** US dollars per million tokens. Cache writes (5-minute TTL) are 1.25× input. */
export interface Price {
  input: number;
  output: number;
  cacheRead: number;
}

/**
 * Anthropic list prices (platform.claude.com pricing, Nov 2026). Includes the
 * server-side fallback targets (Sonnet 5 for Sonnet 5.5, Opus 4.8 for Opus 5),
 * so a rescued call is priced too.
 */
const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.10, output: 0.50, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.20 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.20 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.20 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.50 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.50 },
};

/** Fast mode: twice the standard price. Opus 4.8 is priced like Opus 5 (the dearer reading). */
const FAST_PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 8, output: 40, cacheRead: 0.40 },
  'claude-opus-5': { input: 10, output: 50, cacheRead: 1.0 },
  'claude-opus-4-8': { input: 10, output: 50, cacheRead: 1.0 },
};

/** Haiku 5.5 costs more past a 100K-token prompt. */
const HAIKU_LONG: Price = { input: 0.50, output: 2.50, cacheRead: 0.05 };
const HAIKU_LONG_FROM = 100_000;

/** A model not in the table is priced as the most expensive one there is, so the cap still holds. */
const UNKNOWN_PRICE: Price = { input: 10, output: 50, cacheRead: 1 };

export function priceOf(model: string, promptTokens = 0, fast = false): Price {
  if (fast) return FAST_PRICES[model] ?? UNKNOWN_PRICE;
  if (model === 'claude-haiku-5-5' && promptTokens > HAIKU_LONG_FROM) return HAIKU_LONG;
  return PRICES[model] ?? UNKNOWN_PRICE;
}

export interface ClaudeUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  /** "fast" or "standard" — which speed actually served the call. */
  speed?: string | null;
}

/**
 * What one response cost. When a fallback ran, the dearer of the two models
 * prices it; a fast-mode request is priced fast unless the response says it ran
 * at standard speed.
 */
export function costUsd(models: string[], u: ClaudeUsage, fastRequested = false): number {
  const fast = fastRequested ? u.speed !== 'standard' : u.speed === 'fast';
  const input = u.input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const prompt = input + write + read;
  let worst = 0;
  for (const m of models) {
    const p = priceOf(m, prompt, fast);
    const usd = (input * p.input + write * p.input * 1.25 + read * p.cacheRead + output * p.output) / 1e6;
    worst = Math.max(worst, usd);
  }
  return worst;
}

/**
 * The most a call could cost: the whole prompt written to cache (1.25× input,
 * at ~3 characters a token — generous for English and JSON) and every one of
 * `max_tokens` used. Reserved before sending; settled to the real cost after.
 */
export function worstCaseUsd(model: string, promptChars: number, maxTokens: number, fast = false): number {
  const promptTokens = Math.ceil(promptChars / 3);
  const p = priceOf(model, promptTokens, fast);
  return (promptTokens * p.input * 1.25 + maxTokens * p.output) / 1e6;
}

// ---- the budget period ---------------------------------------------------

export function monthlyBudgetUsd(): number {
  const v = Number(env('ANTHROPIC_MONTHLY_BUDGET_USD') ?? '99');
  return Number.isFinite(v) && v >= 0 ? v : 99;
}

/** Each student's share per UTC day; 0 turns the per-student cap off. */
export function userDailyBudgetUsd(): number {
  const v = Number(env('ANTHROPIC_USER_DAILY_USD') ?? '5');
  return Number.isFinite(v) && v >= 0 ? v : 5;
}

/** Day of the month the credit resets (1–28, UTC). */
export function budgetResetDay(): number {
  const v = Number(env('ANTHROPIC_BUDGET_RESET_DAY') ?? '1');
  return Number.isInteger(v) && v >= 1 && v <= 28 ? v : 1;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** First day (YYYY-MM-DD, UTC) of the budget period `now` falls in. */
export function budgetPeriodStart(now: Date, resetDay = budgetResetDay()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return ymd(new Date(Date.UTC(y, now.getUTCDate() >= resetDay ? m : m - 1, resetDay)));
}

/** Seconds until the next period starts — how long a 402 benches Claude. */
export function secondsToNextPeriod(now: Date, resetDay = budgetResetDay()): number {
  const start = new Date(`${budgetPeriodStart(now, resetDay)}T00:00:00Z`);
  const next = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, resetDay);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

// ---- the ledger ----------------------------------------------------------

export type ReserveResult = 'ok' | 'monthly_cap' | 'user_cap';

export interface Ledger {
  reserve(usd: number, userId: string | null): Promise<ReserveResult>;
  settle(deltaUsd: number, userId: string | null): Promise<void>;
}

export const MONTHLY_SCOPE = 'anthropic';

/** The Postgres ledger (ai_spend_reserve / ai_spend_settle). */
export function dbLedger(now: Date = new Date()): Ledger {
  const period = budgetPeriodStart(now);
  const day = ymd(now);
  const userScope = (u: string | null) => (u ? `anthropic:user:${u}` : null);
  return {
    async reserve(usd, userId) {
      const userCap = userDailyBudgetUsd();
      const rows = await prismaBase().$queryRawUnsafe<Array<{ total: unknown }>>(
        'select ai_spend_reserve($1, $2::date, $3::numeric, $4::numeric, $5, $6::date, $7::numeric) as total',
        MONTHLY_SCOPE,
        period,
        usd,
        monthlyBudgetUsd(),
        userCap > 0 ? userScope(userId) : null,
        day,
        userCap > 0 ? userCap : null,
      );
      const total = rows[0]?.total;
      if (total === null || total === undefined) return 'monthly_cap';
      return Number(total) < 0 ? 'user_cap' : 'ok';
    },
    async settle(delta, userId) {
      if (delta === 0) return;
      await prismaBase().$executeRawUnsafe(
        'select ai_spend_settle($1, $2::date, $3::numeric, $4, $5::date)',
        MONTHLY_SCOPE,
        period,
        delta,
        userDailyBudgetUsd() > 0 ? userScope(userId) : null,
        day,
      );
    },
  };
}

// ---- the call --------------------------------------------------------------

/**
 * Claude cannot be used right now, for `cooldownSeconds`: the month's budget is
 * spent, the credit ran out (402), it is rate-limited or overloaded, or the
 * ledger is unreachable. ai.ts benches every Anthropic model for that long and
 * the pool falls through to Gemini.
 */
export class AnthropicUnavailable extends Error {
  constructor(message: string, readonly cooldownSeconds: number) {
    super(message);
    this.name = 'AnthropicUnavailable';
  }
}

/** Models with a server-side refusal fallback (Haiku 5.5 has none). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5', 'claude-opus-5-5']);

let client: Anthropic | null = null;
function sdk(): Anthropic {
  // maxRetries 0: the pool in ai.ts IS the retry — another model is better than
  // waiting on this one inside Ada's run deadline.
  client ??= new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 0 });
  return client;
}

function currentUser(): string | null {
  try {
    return RequestContext.userId;
  } catch {
    return null;
  }
}

/** The body ai.ts built, with prompt caching, (on Sonnet/Opus) the refusal fallback, and fast mode when asked. Exported for tests. */
// deno-lint-ignore no-explicit-any
export function anthropicBody(model: string, body: Record<string, any>, fast = false): Record<string, any> {
  const betas = [
    ...(FALLBACK_MODELS.has(model) ? ['server-side-fallback-2026-07-01'] : []),
    ...(fast ? ['fast-mode-2026-02-01'] : []),
  ];
  return {
    model,
    ...body,
    // Tools and system render first and never change within a run: one explicit
    // breakpoint on the system prompt caches both, and the top-level marker
    // caches the growing conversation behind it.
    system: [{ type: 'text', text: body.system, cache_control: { type: 'ephemeral' } }],
    cache_control: { type: 'ephemeral' },
    ...(FALLBACK_MODELS.has(model) ? { fallbacks: 'default' } : {}),
    ...(fast ? { speed: 'fast' } : {}),
    ...(betas.length ? { betas } : {}),
  };
}

export interface SendOptions {
  signal: AbortSignal;
  tier: ClaudeTier;
  /** Ask for fast mode (anthropicFast). Falls back to standard speed if refused. */
  fast?: boolean;
  ledger?: Ledger;
  // deno-lint-ignore no-explicit-any
  create?: (body: Record<string, any>, signal: AbortSignal) => Promise<any>;
  now?: Date;
}

/**
 * One Messages call within the budget. Returns the raw response (ai.ts reads it
 * with claudeResult). Throws AnthropicUnavailable to bench Claude, or a plain
 * Error to move this one call to the next candidate.
 */
// deno-lint-ignore no-explicit-any
export async function sendAnthropic(model: string, body: Record<string, any>, opts: SendOptions): Promise<any> {
  const now = opts.now ?? new Date();
  const ledger = opts.ledger ?? dbLedger(now);
  const userId = currentUser();
  const fastAsked = !!opts.fast && FAST_MODELS.has(model);
  try {
    return await attempt(model, body, opts, ledger, userId, now, fastAsked);
  } catch (e) {
    // Fast mode has its own rate limit and is a research preview: when it is
    // busy or refused, standard speed is still Claude — retry once without it
    // rather than benching Claude and dropping to Gemini.
    if (fastAsked && e instanceof FastModeRefused) {
      console.warn(`[anthropic] fast mode refused (${e.message}); retrying ${model} at standard speed`);
      return await attempt(model, body, opts, ledger, userId, now, false);
    }
    throw e;
  }
}

/** Fast mode was rate-limited or rejected; the call itself may still work at standard speed. */
class FastModeRefused extends Error {}

async function attempt(
  model: string,
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>,
  opts: SendOptions,
  ledger: Ledger,
  userId: string | null,
  now: Date,
  fast: boolean,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const reserved = worstCaseUsd(
    model,
    JSON.stringify(body.system ?? '').length + JSON.stringify(body.messages ?? []).length +
      JSON.stringify(body.tools ?? []).length,
    Number(body.max_tokens ?? 16000),
    fast,
  );

  let verdict: ReserveResult;
  try {
    verdict = await ledger.reserve(reserved, userId);
  } catch (e) {
    // Fail closed: no ledger, no spending.
    throw new AnthropicUnavailable(`anthropic ledger unreachable: ${(e as Error).message.slice(0, 200)}`, 60);
  }
  if (verdict === 'monthly_cap') {
    if (fast) throw new FastModeRefused('over the budget at the fast price');
    console.warn(`[anthropic] ANTHROPIC_BUDGET_REACHED — $${monthlyBudgetUsd()} for this period; Gemini answers until it resets`);
    // Re-checked every 10 minutes, so raising the cap takes effect without a deploy.
    throw new AnthropicUnavailable('anthropic monthly budget reached', 600);
  }
  if (verdict === 'user_cap') {
    if (fast) throw new FastModeRefused("over the student's share at the fast price");
    // Only this student, only today — not a reason to bench Claude for everyone.
    throw new Error(`anthropic daily share ($${userDailyBudgetUsd()}) used for this student`);
  }

  const create = opts.create ?? ((b, signal) => sdk().beta.messages.create(b as never, { signal }));
  const started = Date.now();
  // deno-lint-ignore no-explicit-any
  let res: any;
  try {
    res = await create(anthropicBody(model, body, fast), opts.signal);
  } catch (e) {
    if (e instanceof Anthropic.APIError && typeof e.status === 'number') {
      // The API answered with an error: nothing was billed.
      await ledger.settle(-reserved, userId).catch(() => {});
      if (fast && (e.status === 429 || e.status === 400)) throw new FastModeRefused(`${e.status}`);
      const retryAfter = Number(e.headers?.get?.('retry-after'));
      const label = `anthropic ${model} (${e.status})`;
      if (e.status === 402) {
        console.warn(`[anthropic] ${label}: the credit is used up; benched until the next period`);
        throw new AnthropicUnavailable(`${label} billing: credit used up`, secondsToNextPeriod(now));
      }
      if (e.status === 429 || e.status === 529 || e.status === 503) {
        throw new AnthropicUnavailable(`${label} busy`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter + 1 : 60);
      }
      if (e.status === 401 || e.status === 403) {
        console.error(`[anthropic] ${label}: the API key was refused — check ANTHROPIC_API_KEY`);
        throw new AnthropicUnavailable(`${label} key refused`, 3600);
      }
      throw new Error(`${label}: ${e.message.slice(0, 300)}`);
    }
    // Timed out, aborted or the connection dropped: it may have been billed, so
    // the reservation stays (the ledger over-counts rather than under-counts).
    throw new Error(`anthropic ${model}: ${(e as Error).message?.slice(0, 300) ?? String(e)}`);
  }

  const servedBy = typeof res?.model === 'string' ? res.model : model;
  const actual = costUsd([model, servedBy], res?.usage ?? {}, fast);
  await ledger.settle(actual - reserved, userId).catch((e) =>
    console.warn('[anthropic] settle failed (the reservation stands):', (e as Error).message)
  );
  console.log(`[anthropic] ${JSON.stringify({
    model: servedBy,
    tier: opts.tier,
    speed: res?.usage?.speed ?? (fast ? 'fast?' : 'standard'),
    ms: Date.now() - started,
    usd: Number(actual.toFixed(5)),
    in: res?.usage?.input_tokens,
    cache_read: res?.usage?.cache_read_input_tokens,
    out: res?.usage?.output_tokens,
  })}`);
  return res;
}
