// `is_guest` on /profile, and why it has to come from the token.
//
// Reported as "guests are sent to onboarding every time they reopen the app".
// The client skips onboarding when `/profile` says `is_guest || onboarding_complete`,
// and `is_guest` was read from `profiles.is_guest` — a column that defaults to
// false and is never set for a Supabase anonymous sign-up. So every guest came
// back as a real account that had not finished onboarding.
//
// The JWT's `is_anonymous` claim is what this API already trusts for permission
// checks. It is the only answer that is right in both directions below.

import { assertEquals } from 'jsr:@std/assert@1';
import { toDto } from './services/profile.service.ts';

Deno.test('an anonymous session is a guest even though its row says otherwise', () => {
  // The bug: the column's default, false, was what reached the client.
  const row = { is_guest: false, onboarding_complete: false };
  assertEquals(toDto(row, null, true).is_guest, true);
});

Deno.test('a guest who upgraded is not a guest, whatever a stale row says', () => {
  // The other direction: a column would have to be rewritten on upgrade; the
  // token simply stops being anonymous.
  const row = { is_guest: true, onboarding_complete: false };
  assertEquals(toDto(row, null, false).is_guest, false);
});

Deno.test('a missing row cannot turn a real account into a guest', () => {
  // The old fallback was `?? true`: no row meant "guest", which would have
  // skipped onboarding for a real account whose row had not been created yet.
  assertEquals(toDto(null, null, false).is_guest, false);
});
