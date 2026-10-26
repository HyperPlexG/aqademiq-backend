// Two proposals for the same change are recognised as one (pending.ts), so a
// "yes" or "where is it?" no longer stacks duplicate cards.

import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { proposalKey } from './pending.ts';

Deno.test('the same task on the same day is the same proposal, whatever the quotes or case', () => {
  assertEquals(
    proposalKey('create_task', 'Add task “Calling Durvesh”', { date: '2026-10-26' }),
    proposalKey('create_task', 'Add task "calling durvesh"', { date: '2026-10-26', category: 'x' }),
  );
});

Deno.test('a different day or a different tool is a different proposal', () => {
  const base = proposalKey('create_task', 'Add task “Apply for YC”', { date: '2026-10-26' });
  assertNotEquals(base, proposalKey('create_task', 'Add task “Apply for YC”', { date: '2026-10-27' }));
  assertNotEquals(base, proposalKey('update_task', 'Add task “Apply for YC”', { date: '2026-10-26' }));
});
