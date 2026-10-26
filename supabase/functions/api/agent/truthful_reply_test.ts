// The reply has to agree with what the run actually proposed (runtime.ts).
// On 26 Oct 2026 a run with zero proposals said "I have proposed creating 5
// tasks… Please approve them", four turns running.

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { truthfulReply } from './runtime.ts';

const claimed = 'I have proposed creating 5 tasks for you today under the "R13 Labs" tag. Please approve them to add them to your plan.';

Deno.test('nothing proposed and writes rejected: say so, without the id', () => {
  const out = truthfulReply(claimed, 0, ['No subject with id c8617e51-3792-41e4-84f7-9dd5ee818451 belongs to this user.']);
  assertStringIncludes(out, "couldn't set that up");
  assertStringIncludes(out, 'Nothing has been added');
  assert(!out.includes('c8617e51'), 'no raw ids in front of the user');
  assert(!/approve/i.test(out));
});

Deno.test('nothing proposed but the text claims proposals: replaced', () => {
  const out = truthfulReply(claimed, 0, []);
  assert(!/proposed creating/.test(out));
  assertStringIncludes(out, "nothing waiting for you to approve");
});

Deno.test('the other phrasings of a false claim are caught too', () => {
  for (const text of [
    "I've successfully added the tasks to your plan.",
    "I've now proposed the remaining two tasks.",
    'They are now awaiting your confirmation.',
  ]) {
    assert(truthfulReply(text, 0, []) !== text, text);
  }
});

Deno.test('an honest answer with nothing proposed is left alone', () => {
  const text = 'You have 3 tasks today: reading, the lab and a call.';
  assertEquals(truthfulReply(text, 0, []), text);
  const offer = 'Would you like me to add it for tomorrow instead?';
  assertEquals(truthfulReply(offer, 0, []), offer);
});

Deno.test('some proposed, some rejected: the reply keeps its text and says what was not', () => {
  const out = truthfulReply('Here are 3 tasks for you to confirm.', 3, ['The user has no study tag called "Labs".']);
  assertStringIncludes(out, 'Here are 3 tasks');
  assertStringIncludes(out, "1 more change couldn't be prepared");
});

Deno.test('everything proposed: unchanged', () => {
  assertEquals(truthfulReply('Two tasks are waiting for you below.', 2, []), 'Two tasks are waiting for you below.');
});
