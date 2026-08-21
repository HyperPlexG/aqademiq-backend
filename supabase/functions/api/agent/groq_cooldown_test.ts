// Cooldown arithmetic for the OpenAI-compatible providers (Groq, Cerebras).
//
// Getting this wrong is silent and expensive in both directions: bench a key for
// a flat minute when the provider said four seconds and most of a working quota
// is thrown away; bench for four seconds when the limit is daily and the pool
// hammers a dead key all day. Groq is the one provider that actually tells us,
// via Retry-After, so the rule is "ask, don't guess".

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { openAiCooldownSeconds } from '../../_shared/ai.ts';

Deno.test('Retry-After is honoured, with a second of slack', () => {
  // Retrying on the exact boundary tends to 429 again.
  assertEquals(openAiCooldownSeconds('12', ''), 13);
});

Deno.test('a tiny Retry-After is floored, not treated as "retry instantly"', () => {
  assertEquals(openAiCooldownSeconds('0', ''), 5);
  assertEquals(openAiCooldownSeconds('1', ''), 5);
});

Deno.test('an absurd Retry-After is capped rather than benching for hours', () => {
  assert(openAiCooldownSeconds('99999', '') <= 300);
});

Deno.test('whitespace and fractional values still parse', () => {
  assertEquals(openAiCooldownSeconds('  7  ', ''), 8);
  // Ceil first: 7.2s must not round down to a retry that is still too early.
  assertEquals(openAiCooldownSeconds('7.2', ''), 9);
});

Deno.test('a non-numeric Retry-After falls through instead of producing NaN', () => {
  // A NaN cooldown would poison the bench-until timestamp for the whole isolate.
  assertEquals(openAiCooldownSeconds('soon', ''), 60);
});

Deno.test('a per-DAY limit benches until the day rolls over', () => {
  const daily = openAiCooldownSeconds(null, 'Rate limit reached for model per day. Please try again later.');
  assert(daily > 300, `expected a long bench, got ${daily}`);
});

Deno.test('a per-day body loses to an explicit Retry-After', () => {
  // The provider knows better than our regex; the header is the stronger signal.
  assertEquals(openAiCooldownSeconds('30', 'rate limit reached ... per day'), 31);
});

Deno.test('an ordinary 429 with no hints gets the short default', () => {
  assertEquals(openAiCooldownSeconds(null, 'Too Many Requests'), 60);
});
