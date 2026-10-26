// Which tier answers a message (tiers.ts), checked against the messages from
// the 26 Oct 2026 conversation that went wrong, plus the ordinary cases.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { chooseTier, fnv1a, itemCount, nextTier, pickHardVariant } from './tiers.ts';

const tier = (goal: string, extra: Partial<Parameters<typeof chooseTier>[0]> = {}) =>
  chooseTier({ goal, hasAttachments: false, previousRunFailed: false, ...extra }).tier;

Deno.test('a short list of clear tasks goes to the middle tier', () => {
  const goal = 'I have these tasks to complete today all under R13 Labs tag: Calling durvesh\n' +
    'Mailing GC about the prism trademark\nScheduling a call for web summit Qatar\nApplying for YC\nWriting Blogs SEO';
  assertEquals(itemCount(goal), 5);
  assertEquals(tier(goal), 'middle');
});

Deno.test('the user saying it did not work goes to the hard tier', () => {
  for (const goal of ['where is it?', "I can't see any suggestion", 'I CANNOT SEE ANY SUGGESTIOJ OR CARD', '??? not even the task I told you about']) {
    assertEquals(tier(goal), 'hard', goal);
  }
});

Deno.test('a failed previous run sends the next message to the hard tier', () => {
  assertEquals(tier('yes', { previousRunFailed: true }), 'hard');
});

Deno.test('planning and files are hard', () => {
  assertEquals(tier('Can you plan my week around my exams?'), 'hard');
  assertEquals(tier('Add the deadlines from this', { hasAttachments: true }), 'hard');
});

Deno.test('many items at once are hard', () => {
  assertEquals(tier('Add: a, b, c, d, e and f'), 'hard');
});

Deno.test('questions and small talk are easy; changes are middle', () => {
  assertEquals(tier('how am I doing this week?'), 'easy');
  assertEquals(tier('hi'), 'easy');
  assertEquals(tier('move my reading to tomorrow morning'), 'middle');
  assertEquals(tier('tags are r13 labs'), 'middle');
  assertEquals(tier('yes'), 'middle', 'a yes to an offer changes the plan');
  assertEquals(tier('thanks!'), 'easy');
});

Deno.test('escalation climbs one step and stops at hard', () => {
  assertEquals(nextTier('easy'), 'middle');
  assertEquals(nextTier('middle'), 'hard');
  assertEquals(nextTier('hard'), null);
});

Deno.test('the hard model follows ADA_HARD_MODEL; split is stable per user and uses both', () => {
  assertEquals(pickHardVariant('u1', 'gemini'), 'gemini');
  assertEquals(pickHardVariant('u1', 'claude'), 'claude');
  assertEquals(pickHardVariant('u1', 'nonsense'), 'gemini');
  const a = pickHardVariant('user-a', 'split');
  assertEquals(pickHardVariant('user-a', 'split'), a, 'same user, same model every time');
  const seen = new Set(Array.from({ length: 40 }, (_, i) => pickHardVariant(`user-${i}`, 'split')));
  assertEquals(seen.size, 2);
  assert(fnv1a('x') !== fnv1a('y'));
});
