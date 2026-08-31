// Who the per-user daily call cap does not apply to.
//
// The cap is deliberately tight — 20 provider calls is roughly 5 Ada messages a
// day — because the pool is shared and free-tier. That is right for users and
// useless for whoever has to test Ada end to end: the cap is reached before
// lunch, and the only alternative was raising it for everyone, which defeats it.
//
// The exemption is an env allowlist of auth.users.id, read server-side. It is
// never a token claim and never anything the client sends, so the app cannot
// grant itself one — same shape as FEEDBACK_ADMIN_IDS. These tests exist mostly
// to pin the parsing, because a list that silently matches nobody looks exactly
// like a list that works until someone hits the cap.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { dailyCapExempt } from '../services/ada.service.ts';

const ME = 'c7a2c849-2636-4f85-a743-4b74babf578c';
const OTHER = 'a7046f4b-e0a9-4083-a643-a552d66b0420';

function withIds<T>(value: string | undefined, fn: () => T): T {
  if (value === undefined) Deno.env.delete('ADA_DAILY_CALL_UNLIMITED_IDS');
  else Deno.env.set('ADA_DAILY_CALL_UNLIMITED_IDS', value);
  try {
    return fn();
  } finally {
    Deno.env.delete('ADA_DAILY_CALL_UNLIMITED_IDS');
  }
}

Deno.test('nobody is exempt when the secret is unset', () => {
  withIds(undefined, () => {
    assert(!dailyCapExempt(ME));
    assert(!dailyCapExempt(OTHER));
  });
});

Deno.test('an empty secret exempts nobody, rather than everybody', () => {
  // ''.split(',') is [''], so an unfiltered implementation would match a user
  // whose id is the empty string — and worse, invite a "match everything" bug.
  withIds('', () => assert(!dailyCapExempt(ME)));
  withIds('   ', () => assert(!dailyCapExempt(ME)));
});

Deno.test('the listed account is exempt and others are not', () => {
  withIds(ME, () => {
    assert(dailyCapExempt(ME));
    assert(!dailyCapExempt(OTHER), 'exemption must not leak to other accounts');
  });
});

Deno.test('whitespace around a comma-separated list is tolerated', () => {
  // Pasting ids into a dashboard field reliably produces stray spaces.
  withIds(` ${OTHER} , ${ME} `, () => {
    assert(dailyCapExempt(ME));
    assert(dailyCapExempt(OTHER));
  });
});

Deno.test('a partial id does not match', () => {
  // includes() on the SPLIT list, not on the raw string — a substring match
  // would let a truncated or prefix id through.
  withIds(ME, () => {
    assert(!dailyCapExempt(ME.slice(0, 8)));
    assert(!dailyCapExempt(`${ME}-extra`));
  });
});

Deno.test('the id is matched exactly, case included', () => {
  withIds(ME.toUpperCase(), () => assertEquals(dailyCapExempt(ME), false));
});
