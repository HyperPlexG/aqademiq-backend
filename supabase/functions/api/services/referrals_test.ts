// The parts of the referral flow that are decided in code rather than by the
// database.
//
// Uniqueness is not tested here, because it is not enforced here: a duplicate
// code is impossible because `referral_codes.code` carries a unique index, and
// one person cannot be referred twice because `referral_redemptions
// .referred_user_id` does. Both were verified against production directly. The
// retry loop in `ensureCode` is a formality on top of that, not the guarantee.
//
// What IS decided in code, and is worth pinning:
//
//  * The **shape** of a generated code. It has to be typeable into the
//    onboarding field, and that field renders exactly REFERRAL_CODE_LENGTH
//    boxes. The two have already drifted once — the field was capped at 5 while
//    codes were 8, so the full code could not be entered and every referral
//    silently failed at the step meant to capture it.
//  * **Normalisation.** Two endpoints have to agree on what a code is:
//    `/referrals/validate`, which the onboarding step calls to catch typos, and
//    `/onboarding/complete`, which is where attribution actually happens. They
//    used to differ — validate stripped inner whitespace, complete only
//    trimmed — so validate could promise a code that the final submit rejected.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { generateCode, normalizeCode, REFERRAL_CODE_LENGTH } from './referrals.service.ts';

// ---- the shape of a code --------------------------------------------------

Deno.test('a generated code is exactly the length the input field renders', () => {
  // If this fails, the onboarding field and the generator have drifted apart
  // and referrals stop working end to end — silently, because the user simply
  // cannot finish typing.
  assertEquals(REFERRAL_CODE_LENGTH, 8);
  for (let i = 0; i < 200; i++) {
    assertEquals(generateCode().length, REFERRAL_CODE_LENGTH);
  }
});

Deno.test('a generated code is uppercase hex, so it survives the field filter', () => {
  // The field allows [A-Za-z0-9] and force-uppercases. A generator that emitted
  // anything outside that set would produce codes that cannot be entered.
  const hex = /^[0-9A-F]+$/;
  for (let i = 0; i < 200; i++) {
    const c = generateCode();
    assert(hex.test(c), `not uppercase hex: ${c}`);
    assertEquals(c, c.toUpperCase());
  }
});

Deno.test('generated codes are not obviously repeating', () => {
  // Not a uniqueness guarantee — the database provides that. This only catches
  // a generator that has stopped being random at all, which is the failure that
  // would make the unique index start rejecting real signups.
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generateCode());
  assert(seen.size > 495, `only ${seen.size} distinct codes in 500 draws`);
});

// ---- normalisation --------------------------------------------------------

Deno.test('a code is matched case-insensitively', () => {
  // Someone reading a code off a screenshot will type it however they like.
  assertEquals(normalizeCode('a1b2c3d4'), 'A1B2C3D4');
  assertEquals(normalizeCode('A1b2C3d4'), 'A1B2C3D4');
});

Deno.test('surrounding and inner whitespace is stripped', () => {
  // The pasted-from-a-chat-message case. `complete` used to only trim, so
  // "A1B2 C3D4" passed validate and was then rejected at the final submit.
  assertEquals(normalizeCode('  A1B2C3D4  '), 'A1B2C3D4');
  assertEquals(normalizeCode('A1B2 C3D4'), 'A1B2C3D4');
  assertEquals(normalizeCode('A1 B2 C3 D4'), 'A1B2C3D4');
  assertEquals(normalizeCode('\tA1B2C3D4\n'), 'A1B2C3D4');
});

Deno.test('normalising is idempotent', () => {
  // Both entry points normalise; running it twice must not change the answer.
  const once = normalizeCode(' a1b2 c3d4 ');
  assertEquals(normalizeCode(once), once);
});

Deno.test('a generated code passes through normalisation untouched', () => {
  // The round trip that matters: what the owner is shown is exactly what the
  // person they gave it to will be matched on.
  for (let i = 0; i < 100; i++) {
    const c = generateCode();
    assertEquals(normalizeCode(c), c);
  }
});

Deno.test('normalising does not invent a code out of nothing', () => {
  // An empty or whitespace-only input must stay empty rather than becoming a
  // lookup that could match something.
  assertEquals(normalizeCode(''), '');
  assertEquals(normalizeCode('    '), '');
});
