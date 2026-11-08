// Decision models — Jev (TypeSafe's System One model) behind one thin client.
//
// A decision model answers closed questions about some text: pick one option
// from a list (`choice`), rate on a fixed scale (`score`), or give the
// probability that a statement is true (`noul`), each with a calibrated
// probability, many questions per call, in ~0.1–0.3 s. It cannot write text.
// Ada uses it for the decisions a chat model kept getting wrong — which tag,
// which subject, did the user really ask for this task — while a chat model
// still writes titles and replies.
//
// The request is TypeSafe's System One shape, which OpenRouter serves at the
// same path with no waitlist (`typesafe/jev-1.14`), so switching to TypeSafe
// directly, Vercel's gateway, or another System One model is a change of
// `JEV_URL` / `JEV_MODEL`, not of code:
//
//   POST {JEV_URL}   Authorization: Bearer {key}
//   { model, state, questions: { <id>: { type, instructions, criteria } } }
//   → { model, answers: { <id>: { type, choice|noul|score, confidence?, probabilities? } }, usage }
//
// Pin a version, never `~typesafe/jev-latest`: probabilities shift between
// releases and every threshold built on them would silently move.
//
// Docs: docs.typesafe.ai/api/system-one.md, openrouter.ai/docs/guides/community/jev.md

import { env } from './env.ts';

export type Question =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'score'; instructions: string; criteria: string[] };

export type Answer =
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'noul'; noul: number }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> };

export interface DecideResult {
  model: string;
  answers: Record<string, Answer>;
  /** Input tokens are billed; output is free. `cost` (USD) comes from OpenRouter. */
  usage: { input_tokens?: number; output_tokens?: number; cost?: number };
  ms: number;
}

export interface DecideConfig {
  url: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export const DEFAULT_JEV_URL = 'https://openrouter.ai/api/v1/systemone';
export const DEFAULT_JEV_MODEL = 'typesafe/jev-1.14';

/** TypeSafe's per-call limit on one choice's options. */
export const MAX_CHOICES = 255;

/** Null when no key is set — Jev is then simply off. */
export function decideConfig(): DecideConfig | null {
  const apiKey = env('JEV_API_KEY') ?? env('OPENROUTER_API_KEY');
  if (!apiKey) return null;
  const timeout = Number(env('JEV_TIMEOUT_MS') ?? '5000');
  return {
    url: env('JEV_URL') ?? DEFAULT_JEV_URL,
    model: env('JEV_MODEL') ?? DEFAULT_JEV_MODEL,
    apiKey,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 5000,
  };
}

export class DecideError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'DecideError';
  }
}

/**
 * Ask a batch of questions about `state` in one call.
 *
 * Throws `DecideError` on any failure (timeout, HTTP error, a malformed
 * answer). Callers in the request path must treat a throw as "no decision"
 * and fall back to what they did before.
 */
export async function decide(
  state: string | Record<string, unknown> | unknown[],
  questions: Record<string, Question>,
  cfg: DecideConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<DecideResult> {
  if (Object.keys(questions).length === 0) throw new DecideError('no questions');
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === 'choice') {
      const n = Object.keys(q.criteria).length;
      if (n < 1 || n > MAX_CHOICES) throw new DecideError(`question ${id}: ${n} choices (1–${MAX_CHOICES} allowed)`);
    }
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetchImpl(cfg.url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, state, questions }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    throw new DecideError(
      name === 'TimeoutError' || name === 'AbortError'
        ? `timed out after ${cfg.timeoutMs}ms`
        : `network error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const text = await res.text();
  if (!res.ok) throw new DecideError(`HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);

  // deno-lint-ignore no-explicit-any
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DecideError(`not JSON: ${text.slice(0, 200)}`);
  }
  const answers = json?.answers;
  if (!answers || typeof answers !== 'object') throw new DecideError('no answers in the response');
  for (const id of Object.keys(questions)) {
    if (!validAnswer(answers[id], questions[id].type)) {
      throw new DecideError(`answer ${id} missing or malformed: ${JSON.stringify(answers[id] ?? null).slice(0, 200)}`);
    }
  }
  return {
    model: typeof json.model === 'string' ? json.model : cfg.model,
    answers,
    usage: typeof json.usage === 'object' && json.usage ? json.usage : {},
    ms: Date.now() - started,
  };
}

function validAnswer(a: unknown, type: Question['type']): boolean {
  if (!a || typeof a !== 'object') return false;
  // deno-lint-ignore no-explicit-any
  const x = a as any;
  switch (type) {
    case 'choice':
      return typeof x.choice === 'string';
    case 'noul':
      return typeof x.noul === 'number' && x.noul >= 0 && x.noul <= 1;
    case 'score':
      return typeof x.score === 'number';
  }
}
