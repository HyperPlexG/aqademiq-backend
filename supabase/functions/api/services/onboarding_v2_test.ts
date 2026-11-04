// Onboarding v2: "How did you hear about us?" and Study hours.
//
// What is worth pinning: the chips are a closed list (a typo must not become
// a new channel in the numbers), "Other" text is only for Other, study hours
// may run overnight but not be empty, and the write touches only what was
// sent — a skipped step leaves its columns alone.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { HttpError } from '../../_shared/http.ts';
import { HEARD_FROM, onboardingV2Update, parseOnboardingV2 } from './onboarding_v2.ts';

const UID = '00000000-0000-0000-0000-000000000001';

Deno.test('nothing sent → nothing parsed, nothing written', () => {
  const dto = parseOnboardingV2({});
  assertEquals(dto, {});
  assertEquals(onboardingV2Update(UID, dto), null);
});

Deno.test('every design chip is accepted', () => {
  assertEquals(HEARD_FROM.length, 11);
  for (const h of HEARD_FROM) assertEquals(parseOnboardingV2({ heard_from: h }).heard_from, h);
});

Deno.test('an unknown channel is refused', () => {
  assertThrows(() => parseOnboardingV2({ heard_from: 'TikTok' }), HttpError);
  assertThrows(() => parseOnboardingV2({ heard_from: 3 }), HttpError);
});

Deno.test('Other takes a word or two, trimmed; only for Other', () => {
  assertEquals(parseOnboardingV2({ heard_from: 'other', heard_from_other: '  A podcast ' }), {
    heard_from: 'other',
    heard_from_other: 'A podcast',
  });
  assertEquals(parseOnboardingV2({ heard_from: 'other', heard_from_other: '   ' }), { heard_from: 'other' });
  assertThrows(() => parseOnboardingV2({ heard_from: 'tiktok', heard_from_other: 'A podcast' }), HttpError);
  assertThrows(() => parseOnboardingV2({ heard_from: 'other', heard_from_other: 'x'.repeat(61) }), HttpError);
});

Deno.test('study hours: weekdays sorted and de-duplicated', () => {
  const dto = parseOnboardingV2({ study_hours: { days: [5, 1, 3, 1], from_min: 540, until_min: 780 } });
  assertEquals(dto.study_hours, { days: [1, 3, 5], from_min: 540, until_min: 780 });
});

Deno.test('study hours may run overnight, not be empty or out of range', () => {
  assertEquals(parseOnboardingV2({ study_hours: { days: [7], from_min: 1320, until_min: 420 } }).study_hours?.until_min, 420);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [], from_min: 540, until_min: 780 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [0], from_min: 540, until_min: 780 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [8], from_min: 540, until_min: 780 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [1], from_min: 540, until_min: 540 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [1], from_min: 1440, until_min: 60 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: { days: [1], from_min: 9.5, until_min: 780 } }), HttpError);
  assertThrows(() => parseOnboardingV2({ study_hours: [1, 2] }), HttpError);
});

Deno.test('the write sets only what was sent', () => {
  const heard = onboardingV2Update(UID, { heard_from: 'friend' });
  assertEquals(heard?.sql, 'update user_profiles set heard_from = $2, heard_from_other = $3, updated_at = now() where user_id = $1::uuid');
  assertEquals(heard?.params, [UID, 'friend', null]);

  const hours = onboardingV2Update(UID, { study_hours: { days: [1, 2, 3, 4, 5], from_min: 540, until_min: 780 } });
  assertEquals(
    hours?.sql,
    'update user_profiles set study_days = $2::smallint[], study_from_min = $3, study_until_min = $4, updated_at = now() where user_id = $1::uuid',
  );
  assertEquals(hours?.params, [UID, [1, 2, 3, 4, 5], 540, 780]);
});

Deno.test('null means skipped, not an error', () => {
  assertEquals(parseOnboardingV2({ heard_from: null, heard_from_other: null, study_hours: null }), {});
});
