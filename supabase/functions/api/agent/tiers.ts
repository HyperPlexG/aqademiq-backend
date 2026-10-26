// Ada agent — which model tier answers a message.
//
// Ada used to send every message to whichever provider in the pool answered
// first, call by call. One run could start on Gemini and finish on gpt-oss, and
// a weekly plan got the same model as "hi". Now each message is given a tier
// up front and keeps one model for the whole run (see `pin` in _shared/ai.ts):
//
//   easy   — read-only questions and small talk → the free-tier keys
//   middle — a few clear changes                 → Gemini Flash on Vertex
//   hard   — planning, files, many changes, or recovering from a failure
//                                                → a stronger paid model
//
// The choice here is deliberately simple rules. It is the seam a decision model
// (Jev, or another System One API) can replace later: same inputs, same output.
//
// A run that fails on its tier — every proposal rejected — escalates one step
// and tries again before answering (runtime.ts), so a wrong guess here costs a
// retry, never a false "I've proposed…".

import { env } from '../../_shared/env.ts';
import { cacheIncrBy } from '../../_shared/redis.ts';

export type Tier = 'easy' | 'middle' | 'hard';

/** Which stronger model the hard tier uses. Set by ADA_HARD_MODEL. */
export type HardVariant = 'gemini' | 'claude';

export interface TierSignals {
  /** The user's message as sent. */
  goal: string;
  hasAttachments: boolean;
  /**
   * The previous run in this conversation proposed nothing because its
   * proposals were rejected. The user is now asking again, usually confused,
   * and the cheap model already failed them once.
   */
  previousRunFailed: boolean;
}

export interface TierChoice {
  tier: Tier;
  /** Short, for the run log: why this tier. */
  reason: string;
}

const PLANNING =
  /\b(plan|re-?plan|organi[sz]e|re-?organi[sz]e|timetable|prioriti[sz]e|break (it|this|them|that) down|syllabus|study (plan|schedule)|revision (plan|schedule)|exam prep|my (week|month|semester))\b/i;

const WRITE =
  /\b(add|create|make|put|schedule|move|re-?schedule|push|shift|delete|remove|cancel|rename|change|update|edit|mark|tick|complete|set|tag|log|remind)\b/i;

/** The user is telling us the last answer didn't do what it said. */
const CONFUSION =
  /(where (is|are) (it|they|them)|can'?t see|cannot see|don'?t see|not (showing|there|added)|didn'?t (add|work|show)|nothing (showed|appeared|happened)|\?\?)/i;

const QUESTION = /^\s*(what|how|when|why|which|who|whats|what's|is|are|am|do|does|did|can|could|should|will|would)\b|\?\s*$/i;

/**
 * Small talk with nothing to act on. Kept narrow on purpose: a short message is
 * just as often a correction ("tags are r13 labs") or a "yes" to an offer, and
 * those change the plan — they belong on the middle tier.
 */
const SMALL_TALK = /^\s*(hi|hey|hello|hiya|yo|thanks|thank you|thx|ty|ok|okay|cool|nice|great|good (morning|afternoon|evening|night)|bye|see you)\b[\s!.]*$/i;

/** Lines that look like separate items: bullets, numbers, or one per line. */
export function itemCount(goal: string): number {
  const lines = goal.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines.length;
  // "a, b, c and d" after a colon reads as a list too.
  const afterColon = goal.includes(':') ? goal.slice(goal.indexOf(':') + 1) : '';
  return afterColon ? afterColon.split(/,|\band\b/).map((s) => s.trim()).filter(Boolean).length : 1;
}

/** Many separate changes in one message are where cheap models lose track. */
const MANY_ITEMS = 6;

export function chooseTier(s: TierSignals): TierChoice {
  const goal = s.goal.trim();
  if (s.hasAttachments) return { tier: 'hard', reason: 'file attached' };
  if (s.previousRunFailed) return { tier: 'hard', reason: 'last run failed' };
  if (CONFUSION.test(goal)) return { tier: 'hard', reason: 'user says it did not work' };
  if (PLANNING.test(goal)) return { tier: 'hard', reason: 'planning' };
  const items = itemCount(goal);
  if (items >= MANY_ITEMS) return { tier: 'hard', reason: `${items} items` };
  if (WRITE.test(goal)) return { tier: 'middle', reason: 'changes requested' };
  if (QUESTION.test(goal)) return { tier: 'easy', reason: 'question' };
  if (SMALL_TALK.test(goal)) return { tier: 'easy', reason: 'small talk' };
  return { tier: 'middle', reason: 'default' };
}

export function nextTier(t: Tier): Tier | null {
  return t === 'easy' ? 'middle' : t === 'middle' ? 'hard' : null;
}

/**
 * Which hard model a user gets.
 *
 * ADA_HARD_MODEL = gemini (default) | claude | split. `split` sends half the
 * users to each, stably per user, so the two can be compared on real messages
 * before one is chosen. Every run logs its tier and model (runtime.ts), which is
 * what the comparison reads.
 */
export function pickHardVariant(userId: string, setting = env('ADA_HARD_MODEL') ?? 'gemini'): HardVariant {
  const s = setting.trim().toLowerCase();
  if (s === 'claude') return 'claude';
  if (s === 'split') return fnv1a(userId) % 2 === 0 ? 'gemini' : 'claude';
  return 'gemini';
}

/** 32-bit FNV-1a — stable across isolates, unlike Math.random. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Spend guard: at most ADA_HARD_DAILY_CAP hard-tier runs per user per UTC day
 * (default 40). Past it, the run drops to middle rather than failing.
 *
 * Fails open when Redis is unreachable — the cap protects the bill, and a
 * cache outage should not make Ada worse for everyone. It is logged, so a
 * sustained outage is visible.
 */
export async function claimHardRun(userId: string): Promise<boolean> {
  const cap = Number(env('ADA_HARD_DAILY_CAP') ?? '40');
  if (!Number.isFinite(cap) || cap <= 0) return true;
  const day = new Date().toISOString().slice(0, 10);
  const used = await cacheIncrBy(`ada:hard:${userId}:${day}`, 1, 26 * 3600);
  if (used === null) {
    console.warn('[ada-tier] hard-tier cap not enforced: Redis unreachable');
    return true;
  }
  return used <= cap;
}
