// The two decisions in the admin delete path that are silent when wrong.
//
// `adminDeletePost` itself is a transaction over five tables and is not worth
// mocking a database for. These two are worth testing precisely because nothing
// would look wrong if they broke:
//
//  * `isFeedbackAdmin` is the only thing standing between a signed-in user and
//    a delete button. A parsing slip that matches nobody looks exactly like a
//    working allowlist until someone needs it; one that matches everybody looks
//    exactly like it too, from the inside.
//  * `splitChangelogForDelete` decides which "What's new" entries survive the
//    post they came from. Getting it backwards destroys a live, user-visible
//    changelog entry, and the delete response would still read as a success.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { isFeedbackAdmin, splitChangelogForDelete } from './feedback-board.service.ts';

const ME = 'c7a2c849-2636-4f85-a743-4b74babf578c';
const OTHER = 'a7046f4b-e0a9-4083-a643-a552d66b0420';

function withAdmins<T>(value: string | undefined, fn: () => T): T {
  if (value === undefined) Deno.env.delete('FEEDBACK_ADMIN_IDS');
  else Deno.env.set('FEEDBACK_ADMIN_IDS', value);
  try {
    return fn();
  } finally {
    Deno.env.delete('FEEDBACK_ADMIN_IDS');
  }
}

// ---- the allowlist --------------------------------------------------------

Deno.test('nobody is an admin when the secret is unset', () => {
  // Including on a fresh project, where the delete endpoint must be inert
  // rather than open.
  withAdmins(undefined, () => {
    assert(!isFeedbackAdmin(ME));
    assert(!isFeedbackAdmin(OTHER));
  });
});

Deno.test('an empty secret grants nobody, rather than everybody', () => {
  // ''.split(',') is [''], so an unfiltered implementation would match a user
  // whose id is the empty string — and invites a "matches everything" bug on
  // the one surface that can delete other people's posts.
  withAdmins('', () => assert(!isFeedbackAdmin(ME)));
  withAdmins('   ', () => assert(!isFeedbackAdmin(ME)));
  withAdmins(',,', () => assert(!isFeedbackAdmin(ME)));
});

Deno.test('the listed account is an admin and others are not', () => {
  withAdmins(ME, () => {
    assert(isFeedbackAdmin(ME));
    assert(!isFeedbackAdmin(OTHER), 'admin must not leak to other accounts');
  });
});

Deno.test('whitespace around a comma-separated list is tolerated', () => {
  // Pasting ids into a dashboard field reliably produces stray spaces.
  withAdmins(` ${OTHER} , ${ME} `, () => {
    assert(isFeedbackAdmin(ME));
    assert(isFeedbackAdmin(OTHER));
  });
});

Deno.test('a partial id does not match', () => {
  // includes() on the SPLIT list, not on the raw string — a substring match
  // would let a truncated or prefix id through.
  withAdmins(ME, () => {
    assert(!isFeedbackAdmin(ME.slice(0, 8)));
    assert(!isFeedbackAdmin(`${ME}-extra`));
  });
});

Deno.test('the id is matched exactly, case included', () => {
  withAdmins(ME.toUpperCase(), () => assertEquals(isFeedbackAdmin(ME), false));
});

Deno.test('an empty user id never matches', () => {
  // A request that somehow reached the service without a subject must not be
  // able to fall through an allowlist entry.
  withAdmins(ME, () => assert(!isFeedbackAdmin('')));
});

// ---- what happens to the changelog ---------------------------------------

const published = { id: 1n, published_at: new Date('2026-08-01T00:00:00Z') };
const draft = { id: 2n, published_at: null };

Deno.test('a published entry is detached, never removed', () => {
  // "What's new" is a public record of what shipped. It must not disappear
  // because someone tidied the board months later.
  const { detach, remove } = splitChangelogForDelete([published]);
  assertEquals(detach.map((e) => e.id), [1n]);
  assertEquals(remove, []);
});

Deno.test('an unpublished draft goes with the post', () => {
  // adminPatchPost auto-creates this when a post ships; it has no existence
  // apart from the post, so leaving it behind would strand an orphan draft.
  const { detach, remove } = splitChangelogForDelete([draft]);
  assertEquals(detach, []);
  assertEquals(remove.map((e) => e.id), [2n]);
});

Deno.test('a post with both keeps the published one and drops the draft', () => {
  const { detach, remove } = splitChangelogForDelete([published, draft]);
  assertEquals(detach.map((e) => e.id), [1n]);
  assertEquals(remove.map((e) => e.id), [2n]);
});

Deno.test('no entries is not an error', () => {
  const { detach, remove } = splitChangelogForDelete([]);
  assertEquals(detach, []);
  assertEquals(remove, []);
});

Deno.test('every entry lands in exactly one bucket', () => {
  // The property that matters: nothing is silently dropped (an entry in
  // neither bucket keeps a foreign key pointing at a deleted post, which the
  // transaction would then fail on) and nothing is in both.
  const entries = [published, draft, { id: 3n, published_at: new Date() }, { id: 4n, published_at: null }];
  const { detach, remove } = splitChangelogForDelete(entries);
  assertEquals(detach.length + remove.length, entries.length);
  const ids = new Set([...detach, ...remove].map((e) => e.id));
  assertEquals(ids.size, entries.length);
});
