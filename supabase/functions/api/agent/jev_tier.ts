// Jev picks each message's tier — and so its model.
//
//   easy   → Claude Haiku 5.5    questions, small talk
//   middle → Claude Sonnet 5.5   a few clear changes
//   hard   → Claude Opus 5       planning, long lists, recovering from a failure
//
// (_shared/anthropic.ts maps tier → model; the GCP fallback keeps its own map.)
//
// One `choice` question, about 0.2 s. chooseTier()'s rules stay as the floor:
// they decide whenever Jev is off, slow, failing or unsure (confidence below
// JEV_TIER_MIN_CONFIDENCE), and they always decide the two cases Jev cannot see
// — a file attached, and the previous run having failed. A wrong guess costs a
// retry, not a wrong answer: a run whose proposals are all rejected escalates
// one tier (runtime.ts).

import { decide, type DecideConfig, decideConfig, type Question } from '../../_shared/decide.ts';
import { env } from '../../_shared/env.ts';
import type { Tier } from './tiers.ts';

/** The tier question — shared with the shadow (jev_shadow.ts), so both ask the same thing. */
export const TIER_QUESTION: Question = {
  type: 'choice',
  instructions: "How hard is the student's message for a planning assistant?",
  criteria: {
    easy: 'A question about their plan, advice, or small talk. Nothing to change.',
    middle: 'One to five clear changes the student spelled out (add, move, edit, complete or delete tasks).',
    hard: 'Building a plan or schedule, a long list of six or more items, a file, or the student saying the last answer did not work.',
  },
};

const TIERS: readonly Tier[] = ['easy', 'middle', 'hard'];

/** On whenever a Jev key is set, unless ADA_JEV_TIER=off. Shorter timeout than the shadow: the student is waiting. */
export function jevTierConfig(): DecideConfig | null {
  if ((env('ADA_JEV_TIER') ?? '').trim().toLowerCase() === 'off') return null;
  const cfg = decideConfig();
  if (!cfg) return null;
  const t = Number(env('JEV_TIER_TIMEOUT_MS') ?? '1500');
  return { ...cfg, timeoutMs: Number.isFinite(t) && t > 0 ? t : 1500 };
}

/** Below this, the rules decide. */
export function minTierConfidence(): number {
  const v = Number(env('JEV_TIER_MIN_CONFIDENCE') ?? '0.6');
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.6;
}

/** What Jev reads: the message, and Ada's last reply so a bare "yes" has something to agree to. */
export function tierState(goal: string, lastReply: string | null): string {
  const lines = [];
  if (lastReply?.trim()) lines.push("Ada's previous reply:", lastReply.trim().slice(0, 600), '');
  lines.push("The student's message:", goal.trim().slice(0, 4000));
  return lines.join('\n');
}

export interface JevTier {
  tier: Tier;
  confidence: number;
  ms: number;
}

/** Ask Jev. Never throws: null means "let the rules decide". */
export async function askJevTier(
  goal: string,
  lastReply: string | null,
  cfg: DecideConfig,
  decideImpl = decide,
): Promise<JevTier | null> {
  try {
    const r = await decideImpl(tierState(goal, lastReply), { tier: TIER_QUESTION }, cfg);
    // deno-lint-ignore no-explicit-any
    const a = r.answers.tier as any;
    if (!TIERS.includes(a?.choice)) return null;
    return { tier: a.choice, confidence: typeof a.confidence === 'number' ? a.confidence : 0, ms: r.ms };
  } catch (e) {
    console.warn('[jev-tier] rules decide:', (e as Error).message.slice(0, 200));
    return null;
  }
}

export interface TierPick {
  tier: Tier;
  reason: string;
  /** What the rules alone said — the shadow compares Jev against this. */
  ruleTier: Tier;
}

/**
 * The tier for a run: Jev's when it is confident, the rules' otherwise.
 * `forced` is a rule Jev cannot overrule (a file, a failed previous run).
 */
export function pickTier(rules: { tier: Tier; reason: string }, forced: boolean, jev: JevTier | null, min = minTierConfidence()): TierPick {
  const base = { ruleTier: rules.tier };
  if (forced || !jev) return { ...base, tier: rules.tier, reason: rules.reason };
  if (jev.confidence >= min) {
    return { ...base, tier: jev.tier, reason: `jev ${jev.confidence.toFixed(2)}; rules said ${rules.tier} (${rules.reason})` };
  }
  return { ...base, tier: rules.tier, reason: `${rules.reason}; jev unsure (${jev.tier} ${jev.confidence.toFixed(2)})` };
}
