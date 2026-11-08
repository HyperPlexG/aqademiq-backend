// Jev in shadow (jev_shadow.ts) and its client (_shared/decide.ts).
//
// The case these are built around is the one from 26 Oct 2026: a student
// listed five tasks "under the R13 Labs tag", the model put that tag's id in
// `subject_id`, and later invented two tasks nobody asked for. Jev's job in
// shadow is to notice exactly those — so the comparison must map its answers
// back to the student's ids and flag them.

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { decide, type DecideConfig, DecideError, type DecideResult } from '../../_shared/decide.ts';
import { compareShadow, MAX_SHADOW_PROPOSALS, NONE, type ShadowInput, shadowConfig, shadowQuestions } from './jev_shadow.ts';

const R13 = '11111111-1111-4111-8111-111111111111';
const LAB = '22222222-2222-4222-8222-222222222222';
const GENAI = '33333333-3333-4333-8333-333333333333';

function input(over: Partial<ShadowInput> = {}): ShadowInput {
  return {
    goal: 'I have these tasks today under the R13 Labs tag: call Durvesh, mail GC about the trademark',
    ruleTier: 'middle',
    subjects: [{ id: GENAI, name: 'Generative AI' }],
    tags: [{ id: R13, label: 'R13 Labs' }, { id: LAB, label: 'Lab' }],
    proposals: [
      { id: 'a1', tool: 'create_task', title: 'Add task “Call Durvesh”', args: { title: 'Call Durvesh', date: '2026-11-07', category: R13 } },
      { id: 'a2', tool: 'create_task', title: 'Add task “ML exam”', args: { title: 'ML exam', date: '2026-11-07', subject_id: GENAI } },
      { id: 'a3', tool: 'delete_task', title: 'Delete “Old task”', args: { task_id: 'x' } },
    ],
    reply: "I've proposed 3 changes.",
    ...over,
  };
}

Deno.test('every task card gets named, tag and subject questions; other cards only named', () => {
  const q = shadowQuestions(input());
  assertEquals(Object.keys(q.questions).sort(), [
    'intent', 'p0_named', 'p0_subject', 'p0_tag', 'p1_named', 'p1_subject', 'p1_tag', 'p2_named', 'reply_true', 'tier',
  ]);
  const tag = q.questions.p0_tag;
  assert(tag.type === 'choice');
  assertEquals(Object.keys(tag.criteria), [NONE, 'R13 Labs', 'Lab']);
  assertEquals(q.tagKeys, { 'R13 Labs': R13, 'Lab': LAB });
  // The state shows what the model chose, by name, so Jev judges the card the
  // student actually saw.
  assert(q.state.includes('tag: R13 Labs'));
  assert(q.state.includes('subject: Generative AI'));
});

Deno.test('two tags with one name stay two choices', () => {
  const q = shadowQuestions(input({ tags: [{ id: R13, label: 'Lab' }, { id: LAB, label: 'Lab' }] }));
  assertEquals(q.tagKeys, { 'Lab': R13, 'Lab (2)': LAB });
});

Deno.test('a long run asks about at most MAX_SHADOW_PROPOSALS cards', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, tool: 'create_task', title: `Task ${i}`, args: {} }));
  const q = shadowQuestions(input({ proposals: many }));
  assertEquals(q.asked.length, MAX_SHADOW_PROPOSALS);
  assert(!(`p${MAX_SHADOW_PROPOSALS}_named` in q.questions));
});

function answers(over: Record<string, unknown> = {}): DecideResult {
  return {
    model: 'typesafe/jev-1.14',
    ms: 180,
    usage: { input_tokens: 900, cost: 0.00004 },
    answers: {
      tier: { type: 'choice', choice: 'middle', confidence: 0.8, probabilities: {} },
      intent: { type: 'choice', choice: 'add_tasks', confidence: 0.9, probabilities: {} },
      reply_true: { type: 'noul', noul: 0.95 },
      p0_named: { type: 'noul', noul: 0.97 },
      p0_tag: { type: 'choice', choice: 'R13 Labs', confidence: 0.92, probabilities: {} },
      p0_subject: { type: 'choice', choice: NONE, confidence: 0.85, probabilities: {} },
      // The invented task: Jev says nobody asked for it, and no subject was given.
      p1_named: { type: 'noul', noul: 0.04 },
      p1_tag: { type: 'choice', choice: 'R13 Labs', confidence: 0.75, probabilities: {} },
      p1_subject: { type: 'choice', choice: NONE, confidence: 0.9, probabilities: {} },
      p2_named: { type: 'noul', noul: 0.6 },
      ...over,
    // deno-lint-ignore no-explicit-any
    } as any,
  };
}

Deno.test('the comparison maps Jev back to ids and flags the invented card', () => {
  const inp = input();
  const c = compareShadow(shadowQuestions(inp), inp, answers());
  assertEquals(c.tier, { rules: 'middle', jev: 'middle', confidence: 0.8, agree: true });
  assertEquals(c.cards[0].tag, { ada: R13, jev: R13, confidence: 0.92, agree: true });
  assertEquals(c.cards[0].subject, { ada: null, jev: null, confidence: 0.85, agree: true });
  assertEquals(c.likely_invented, ['a2']);
  // Card 2: the model put no tag (Jev says R13 Labs, 0.75) and a subject
  // (Jev says none, 0.9) — two confident disagreements.
  assertEquals(c.confident_disagreements, 2);
  assertEquals(c.cards[2].tag, undefined);
});

Deno.test('a disagreement Jev is unsure of is not counted as confident', () => {
  const inp = input({ proposals: input().proposals.slice(0, 1) });
  const c = compareShadow(shadowQuestions(inp), inp, answers({
    p0_tag: { type: 'choice', choice: 'Lab', confidence: 0.5, probabilities: {} },
  }));
  assertEquals(c.cards[0].tag?.agree, false);
  assertEquals(c.confident_disagreements, 0);
});

const cfg: DecideConfig = { url: 'https://jev.test/v1/systemone', model: 'typesafe/jev-1.14', apiKey: 'k', timeoutMs: 50 };

Deno.test('decide sends the System One request and returns the answers', async () => {
  let seen: { url: string; auth: string | null; body: Record<string, unknown> } | null = null;
  const fake = (url: string | URL | Request, init?: RequestInit) => {
    seen = {
      url: String(url),
      auth: new Headers(init?.headers).get('Authorization'),
      body: JSON.parse(String(init?.body)),
    };
    return Promise.resolve(Response.json({
      model: 'typesafe/jev-1.14',
      answers: { yes: { type: 'noul', noul: 0.9 } },
      usage: { input_tokens: 10, cost: 0.0000004 },
    }));
  };
  const r = await decide('state', { yes: { type: 'noul', instructions: 'Is it?' } }, cfg, fake as typeof fetch);
  assertEquals(r.answers.yes, { type: 'noul', noul: 0.9 });
  assertEquals(r.usage.cost, 0.0000004);
  assertEquals(seen!.url, cfg.url);
  assertEquals(seen!.auth, 'Bearer k');
  assertEquals(seen!.body, { model: 'typesafe/jev-1.14', state: 'state', questions: { yes: { type: 'noul', instructions: 'Is it?' } } });
});

Deno.test('decide throws on an HTTP error, a missing answer, or too many choices', async () => {
  const q = { yes: { type: 'noul' as const, instructions: 'Is it?' } };
  await assertRejects(
    () => decide('s', q, cfg, (() => Promise.resolve(new Response('{"detail":"bad"}', { status: 422 }))) as typeof fetch),
    DecideError,
    'HTTP 422',
  );
  await assertRejects(
    () => decide('s', q, cfg, (() => Promise.resolve(Response.json({ answers: {} }))) as typeof fetch),
    DecideError,
    'answer yes missing',
  );
  const criteria = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`o${i}`, null]));
  await assertRejects(
    () => decide('s', { pick: { type: 'choice', instructions: 'Pick', criteria } }, cfg, fetch),
    DecideError,
    '256 choices',
  );
});

Deno.test('decide gives up after its timeout', async () => {
  const hang = ((_u: unknown, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)))) as typeof fetch;
  await assertRejects(() => decide('s', { yes: { type: 'noul', instructions: 'x' } }, cfg, hang), DecideError, 'timed out after 50ms');
});

Deno.test('shadow is off without a key, and off when switched off', () => {
  const saved = ['OPENROUTER_API_KEY', 'JEV_API_KEY', 'ADA_JEV_SHADOW'].map((k) => [k, Deno.env.get(k)] as const);
  try {
    Deno.env.delete('OPENROUTER_API_KEY');
    Deno.env.delete('JEV_API_KEY');
    Deno.env.delete('ADA_JEV_SHADOW');
    assertEquals(shadowConfig(), null);
    Deno.env.set('OPENROUTER_API_KEY', 'or-key');
    assertEquals(shadowConfig()?.model, 'typesafe/jev-1.14');
    assertEquals(shadowConfig()?.url, 'https://openrouter.ai/api/v1/systemone');
    Deno.env.set('ADA_JEV_SHADOW', 'off');
    assertEquals(shadowConfig(), null);
  } finally {
    for (const [k, v] of saved) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  }
});
