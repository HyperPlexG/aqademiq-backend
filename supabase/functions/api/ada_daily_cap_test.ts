// The per-student daily call ceiling (services/ada.service.ts dailyCallCap).
//
// On the free-tier pool it stays tight (20, ~5 messages). With Claude through
// Anthropic's API the money cap in Postgres is the real limit, so the call cap
// relaxes to 200 — on 8 Nov 2026 the 20-call cap stopped a student after five
// messages with nearly all of their $5 daily share unspent.

import { assertEquals } from 'jsr:@std/assert@1';
import { dailyCallCap } from './services/ada.service.ts';

Deno.test('free-tier pool: 20 calls a day unless set', () => {
  assertEquals(dailyCallCap(undefined, false), 20);
  assertEquals(dailyCallCap('', false), 20);
});

Deno.test('Claude direct: 200 calls a day unless set', () => {
  assertEquals(dailyCallCap(undefined, true), 200);
  assertEquals(dailyCallCap('  ', true), 200);
});

Deno.test('an explicit ADA_DAILY_CALL_CAP always wins, 0 disables it', () => {
  assertEquals(dailyCallCap('50', true), 50);
  assertEquals(dailyCallCap('0', true), 0);
  assertEquals(dailyCallCap('nonsense', true), 200);
  assertEquals(dailyCallCap('-3', false), 20);
});
