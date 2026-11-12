// Tests for the "no check-ins for days that haven't happened" rule.
//
// The day a student logs is their local day, which can be up to 14 hours ahead
// of UTC. Comparing it with the UTC date rejected a morning check-in in Dubai
// (UTC+4) or Sydney (UTC+10/11) for the hours before UTC midnight.

import { assertThrows } from 'jsr:@std/assert@1';
import { assertNotFuture } from './mood.service.ts';

const T = (iso: string) => new Date(iso);

Deno.test("today east of UTC is not the future", () => {
  // 22:30 UTC on the 10th is 02:30 on the 11th in Dubai.
  assertNotFuture(T('2026-11-11T00:00:00Z'), T('2026-11-10T22:30:00Z'));
});

Deno.test('today and earlier are fine', () => {
  assertNotFuture(T('2026-11-10T00:00:00Z'), T('2026-11-10T09:00:00Z'));
  assertNotFuture(T('2026-11-01T00:00:00Z'), T('2026-11-10T09:00:00Z'));
});

Deno.test('a day that has not started anywhere is refused', () => {
  // 09:00 UTC on the 10th: even UTC+14 is only at 23:00 on the 10th.
  assertThrows(() => assertNotFuture(T('2026-11-11T00:00:00Z'), T('2026-11-10T09:00:00Z')));
  assertThrows(() => assertNotFuture(T('2026-11-12T00:00:00Z'), T('2026-11-10T22:30:00Z')));
});
