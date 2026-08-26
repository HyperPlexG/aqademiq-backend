// A failed provider call still spent provider quota.
//
// The loop used to tally a call only after `await createMessage(...)` returned,
// so a 429 or a timeout threw straight past the tally. The call was made, the
// free-tier request was consumed, and the ledger showed nothing.
//
// Two things went wrong as a result. Within a run, `remainingCalls` overstated
// what was left, so a run could keep retrying against an already-exhausted pool.
// Across days, `llm_calls` on `ada_agent_runs` is what the per-user daily cap
// sums — so the user whose calls were all failing was charged the least, and a
// provider having a bad minute quietly lifted everyone's ceiling at exactly the
// moment the shared pool could least afford it.
//
// Attempts are what the free tier meters, so attempts are what these assert.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { Budget } from './runtime.ts';

const usage = (p: number, c: number) => ({ prompt_tokens: p, completion_tokens: c, model: 'gemini-2.5-flash' });

Deno.test('a call is counted at dispatch, before its outcome is known', () => {
  const b = new Budget(60_000, 4);
  assertEquals(b.remainingCalls, 4);
  b.beginCall();
  assertEquals(b.remainingCalls, 3, 'the attempt must be charged immediately');
});

Deno.test('a call that throws is still charged', () => {
  const b = new Budget(60_000, 4);
  // Simulates the provider rejecting: beginCall ran, settleCall never did.
  b.beginCall();
  b.beginCall();
  assertEquals(b.totalCalls, 2);
  assertEquals(b.phaseUsage.llm_calls, 2, 'failures must reach the daily cap');
});

Deno.test('a successful call is charged exactly once, not twice', () => {
  // The regression this guards: settling a call must not re-increment it.
  const b = new Budget(60_000, 4);
  b.beginCall();
  b.settleCall(120, usage(1000, 200));
  assertEquals(b.totalCalls, 1);
  assertEquals(b.phaseUsage.prompt_tokens, 1000);
  assertEquals(b.phaseUsage.completion_tokens, 200);
});

Deno.test('an all-failing run exhausts its call budget instead of looping forever', () => {
  const b = new Budget(60_000, 3);
  let dispatched = 0;
  while (b.canCall()) {
    b.beginCall();
    dispatched++;
    if (dispatched > 10) break; // guard against the very bug under test
  }
  assertEquals(dispatched, 3, 'the loop must stop at maxCalls even with zero successes');
  assertEquals(b.stoppedReason, 'call_budget');
});

Deno.test('token totals ignore calls that never settled', () => {
  const b = new Budget(60_000, 4);
  b.beginCall();
  b.settleCall(100, usage(500, 50));
  b.beginCall(); // threw — no tokens to attribute
  assertEquals(b.totalCalls, 2);
  assertEquals(b.totalPromptTokens, 500, 'a failed call contributes no tokens');
});

Deno.test('a resumed run carries prior spend into its lifetime total', () => {
  const b = new Budget(15_000, 2);
  b.carry(3, 4000, 800);
  b.beginCall();
  b.settleCall(90, usage(1000, 100));
  assertEquals(b.totalCalls, 4, '3 carried + 1 this phase');
  // The resume still gets its own allowance — carried calls must not consume it.
  assert(b.remainingCalls > 0);
});
