// Ada × Jev, in shadow.
//
// Jev runs beside every chat run and changes nothing the user sees. For each
// run it answers, in one call, the decisions Ada's chat model makes today:
//
//   tier          easy | middle | hard          — against chooseTier()'s rules
//   intent        what the message is asking for
//   p<n>_named    "did the user ask for this card?" — invented tasks
//   p<n>_tag      which of the user's study tags (or none) — vs the model's pick
//   p<n>_subject  which subject (or none)                   — vs the model's pick
//   reply_true    does the reply claim only what was proposed?
//
// Each answer is stored with what Ada actually did (`ada_jev_shadow`), and the
// cards' later fate (approved / declined) is the ground truth: a card Jev
// thought the user never asked for that the user then declined is a catch; one
// they approved is a false alarm. scripts/jev_report.sql reads it.
//
// Switching anything over is a separate decision, made on that data — see
// docs/JEV.md. Until then this file must stay side-effect free for the user:
// it runs after the reply has been sent (EdgeRuntime.waitUntil), never throws,
// and its only write is its own table.

import { prismaBase } from '../../_shared/prisma.ts';
import { env } from '../../_shared/env.ts';
import { decide, type DecideConfig, decideConfig, DecideError, type DecideResult, MAX_CHOICES, type Question } from '../../_shared/decide.ts';
import type { Tier } from './tiers.ts';
import { TIER_QUESTION } from './jev_tier.ts';

/** At most this many cards get per-card questions, so one call stays small. */
export const MAX_SHADOW_PROPOSALS = 15;

/** The label Jev picks when the user gave no tag / no subject. */
export const NONE = '(none)';

export interface ShadowProposal {
  id: string;
  tool: string;
  /** The card's title, e.g. `Add task “Call Durvesh”`. */
  title: string;
  args: Record<string, unknown>;
}

export interface ShadowInput {
  goal: string;
  ruleTier: Tier;
  subjects: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; label: string }>;
  proposals: ShadowProposal[];
  reply: string;
}

export interface ShadowQuestions {
  state: string;
  questions: Record<string, Question>;
  /** Choice key → id, per card, so answers map back to the user's records. */
  tagKeys: Record<string, string>;
  subjectKeys: Record<string, string>;
  /** Which cards got per-card questions, in order (p0, p1, …). */
  asked: ShadowProposal[];
}

/** Tools whose args carry a tag (`category`) and a subject (`subject_id`). */
const TAGGED_TOOLS = new Set(['create_task', 'update_task']);

/**
 * Unique, non-empty choice keys for a list of labels. Jev answers with the key,
 * so two tags both called "Lab" must not collapse into one.
 */
function keysFor<T>(items: T[], label: (t: T) => string, id: (t: T) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of items) {
    const base = label(item).trim().slice(0, 80) || 'untitled';
    let key = base === NONE ? `${base} ` : base;
    for (let n = 2; key in out; n++) key = `${base} (${n})`;
    out[key] = id(item);
    if (Object.keys(out).length >= MAX_CHOICES - 1) break;
  }
  return out;
}

function criteriaOf(keys: Record<string, string>, noneMeans: string): Record<string, string | null> {
  const c: Record<string, string | null> = { [NONE]: noneMeans };
  for (const k of Object.keys(keys)) c[k] = null;
  return c;
}

function cardLine(p: ShadowProposal, tagName: (id: unknown) => string, subjectName: (id: unknown) => string): string {
  if (!TAGGED_TOOLS.has(p.tool)) return p.title;
  const bits: string[] = [];
  if (p.args.date) bits.push(`date ${p.args.date}`);
  if (p.args.part_of_day) bits.push(`${p.args.part_of_day}`);
  if (p.args.scheduled_at) bits.push(`at ${p.args.scheduled_at}`);
  bits.push(`tag: ${tagName(p.args.category)}`);
  bits.push(`subject: ${subjectName(p.args.subject_id)}`);
  return `${p.title} (${bits.join(', ')})`;
}

/** The one call's state and questions. Pure; tested. */
export function shadowQuestions(input: ShadowInput): ShadowQuestions {
  const tagKeys = keysFor(input.tags, (t) => t.label, (t) => t.id);
  const subjectKeys = keysFor(input.subjects, (s) => s.name, (s) => s.id);
  const tagById = new Map(input.tags.map((t) => [t.id, t.label]));
  const subjectById = new Map(input.subjects.map((s) => [s.id, s.name]));
  const tagName = (id: unknown) => (typeof id === 'string' && tagById.get(id)) || 'none';
  const subjectName = (id: unknown) => (typeof id === 'string' && subjectById.get(id)) || 'none';
  const asked = input.proposals.slice(0, MAX_SHADOW_PROPOSALS);

  const lines = [
    "The student's message to Ada, their study planner:",
    input.goal.trim(),
    '',
    `The student's study tags: ${input.tags.map((t) => t.label).join(', ') || 'none'}`,
    `The student's subjects: ${input.subjects.map((s) => s.name).join(', ') || 'none'}`,
    '',
    asked.length
      ? `Changes Ada proposed (cards the student approves or declines):\n${asked.map((p, i) => `${i + 1}. ${cardLine(p, tagName, subjectName)}`).join('\n')}`
      : 'Ada proposed no changes.',
    '',
    "Ada's reply:",
    input.reply.trim() || '(no reply)',
  ];

  const questions: Record<string, Question> = {
    tier: TIER_QUESTION,
    intent: {
      type: 'choice',
      instructions: "What is the student's message asking Ada to do?",
      criteria: {
        question: 'Answer a question or give advice; change nothing.',
        small_talk: 'Greeting, thanks or chat with nothing to act on.',
        add_tasks: 'Add one or more new tasks.',
        change_tasks: 'Move, edit, complete or delete existing tasks.',
        plan: 'Build or rearrange a plan or schedule for a day, week or exam.',
        other: 'Anything else (subjects, tags, mood, memories, files).',
      },
    },
    reply_true: {
      type: 'noul',
      instructions: "Does Ada's reply describe the proposed changes truthfully — no change claimed that is not in the list, and none in the list denied?",
      criteria: {
        true: 'The reply matches the list of proposed changes (or proposes nothing and claims nothing).',
        false: 'The reply claims changes that are not in the list, or says nothing was proposed when something was.',
      },
    },
  };

  asked.forEach((p, i) => {
    questions[`p${i}_named`] = {
      type: 'noul',
      instructions: `Did the student ask for change ${i + 1}, "${p.title}", in their message?`,
      criteria: {
        true: 'The message names this task or change, or clearly asks for it.',
        false: 'The message does not ask for it; Ada added it on its own.',
      },
    };
    if (TAGGED_TOOLS.has(p.tool)) {
      questions[`p${i}_tag`] = {
        type: 'choice',
        instructions: `Which of the student's study tags did the student give for change ${i + 1}, "${p.title}"?`,
        criteria: criteriaOf(tagKeys, 'The student gave no tag for it.'),
      };
      questions[`p${i}_subject`] = {
        type: 'choice',
        instructions: `Which of the student's subjects did the student give for change ${i + 1}, "${p.title}"?`,
        criteria: criteriaOf(subjectKeys, 'The student named no subject for it.'),
      };
    }
  });

  return { state: lines.join('\n'), questions, tagKeys, subjectKeys, asked };
}

export interface CardVerdict {
  id: string;
  named: number;
  /** null when the card carries no tag/subject (not a task card). */
  tag?: { ada: string | null; jev: string | null; confidence: number; agree: boolean };
  subject?: { ada: string | null; jev: string | null; confidence: number; agree: boolean };
}

export interface ShadowComparison {
  tier: { rules: Tier; jev: string; confidence: number; agree: boolean };
  intent: { jev: string; confidence: number };
  reply_true: number;
  cards: CardVerdict[];
  /** Cards Jev is fairly sure the user never asked for (named ≤ 0.3). */
  likely_invented: string[];
  /** Tag or subject picks Jev disagrees with at confidence ≥ 0.7. */
  confident_disagreements: number;
}

/** Jev's answers set against what Ada did. Pure; tested. */
export function compareShadow(q: ShadowQuestions, input: ShadowInput, r: DecideResult): ShadowComparison {
  // deno-lint-ignore no-explicit-any
  const a = r.answers as Record<string, any>;
  const tierAns = a.tier;
  const cards: CardVerdict[] = [];
  let confident = 0;
  q.asked.forEach((p, i) => {
    const v: CardVerdict = { id: p.id, named: a[`p${i}_named`]?.noul ?? NaN };
    const pick = (ans: { choice: string; confidence: number } | undefined, keys: Record<string, string>, adaId: unknown) => {
      if (!ans) return undefined;
      const jev = ans.choice === NONE ? null : keys[ans.choice] ?? null;
      const ada = typeof adaId === 'string' && adaId ? adaId : null;
      const agree = jev === ada;
      if (!agree && ans.confidence >= 0.7) confident++;
      return { ada, jev, confidence: ans.confidence, agree };
    };
    const tag = pick(a[`p${i}_tag`], q.tagKeys, p.args.category);
    const subject = pick(a[`p${i}_subject`], q.subjectKeys, p.args.subject_id);
    if (tag) v.tag = tag;
    if (subject) v.subject = subject;
    cards.push(v);
  });
  return {
    tier: { rules: input.ruleTier, jev: tierAns.choice, confidence: tierAns.confidence, agree: tierAns.choice === input.ruleTier },
    intent: { jev: a.intent.choice, confidence: a.intent.confidence },
    reply_true: a.reply_true.noul,
    cards,
    likely_invented: cards.filter((c) => c.named <= 0.3).map((c) => c.id),
    confident_disagreements: confident,
  };
}

/** On when a Jev key is set, unless `ADA_JEV_SHADOW=off`. */
export function shadowConfig(): DecideConfig | null {
  if ((env('ADA_JEV_SHADOW') ?? '').trim().toLowerCase() === 'off') return null;
  return decideConfig();
}

export interface ShadowRun {
  runId: string;
  userId: string;
  goal: string;
  ruleTier: Tier;
  subjects: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; label: string }>;
  pendingIds: string[];
  reply: string;
}

/**
 * Ask Jev and store the result. Never throws: a failure is stored as an error
 * row (so outages show up in the report) and logged.
 */
export async function runJevShadow(run: ShadowRun, cfg: DecideConfig, decideImpl = decide): Promise<void> {
  let q: ShadowQuestions | null = null;
  let result: DecideResult | null = null;
  let comparison: ShadowComparison | null = null;
  let error: string | null = null;
  try {
    const rows = run.pendingIds.length
      ? await prismaBase().adaPendingAction.findMany({
        where: { id: { in: run.pendingIds } },
        select: { id: true, tool_name: true, title: true, args: true },
        orderBy: { created_at: 'asc' },
      })
      : [];
    const input: ShadowInput = {
      goal: run.goal,
      ruleTier: run.ruleTier,
      subjects: run.subjects,
      tags: run.tags,
      // deno-lint-ignore no-explicit-any
      proposals: rows.map((p: any) => ({ id: p.id, tool: p.tool_name, title: p.title, args: (p.args ?? {}) as Record<string, unknown> })),
      reply: run.reply,
    };
    q = shadowQuestions(input);
    result = await decideImpl(q.state, q.questions, cfg);
    comparison = compareShadow(q, input, result);
  } catch (e) {
    error = e instanceof DecideError ? e.message : `${e instanceof Error ? e.name : 'Error'}: ${e instanceof Error ? e.message : String(e)}`;
  }

  console.log(`[jev-shadow] ${JSON.stringify({
    run: run.runId,
    ms: result?.ms,
    tier: comparison ? `${comparison.tier.rules}→${comparison.tier.jev}` : undefined,
    invented: comparison?.likely_invented.length,
    disagree: comparison?.confident_disagreements,
    error: error ?? undefined,
  })}`);

  try {
    await prismaBase().$executeRawUnsafe(
      `insert into ada_jev_shadow
         (run_id, user_id, model, ms, input_tokens, cost_usd, rule_tier, jev_tier, tier_agree,
          likely_invented, confident_disagreements, questions, answers, comparison, error)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15)`,
      run.runId,
      run.userId,
      result?.model ?? cfg.model,
      result?.ms ?? null,
      result?.usage.input_tokens ?? null,
      result?.usage.cost ?? null,
      run.ruleTier,
      comparison?.tier.jev ?? null,
      comparison?.tier.agree ?? null,
      comparison?.likely_invented.length ?? null,
      comparison?.confident_disagreements ?? null,
      JSON.stringify(q ? { state: q.state, questions: q.questions } : null),
      JSON.stringify(result?.answers ?? null),
      JSON.stringify(comparison),
      error,
    );
  } catch (e) {
    // Most likely the migration has not been applied yet.
    console.warn('[jev-shadow] not stored:', (e as Error).message.slice(0, 300));
  }
}

/**
 * Run `task` after the response is sent. Supabase Edge keeps the isolate alive
 * for promises handed to EdgeRuntime.waitUntil; elsewhere (tests, local) the
 * promise simply runs on its own.
 */
export function afterResponse(task: Promise<void>): void {
  const guarded = task.catch((e) => console.warn('[jev-shadow] failed:', (e as Error).message));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(guarded);
}
