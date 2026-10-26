// Gemini's generationConfig (_shared/ai.ts).
//
// Gemini 3 counts thinking toward maxOutputTokens and thinks hard by default.
// On 27 Oct 2026, with Ada's 2,400-token budget, both 3.8 Flash and 3.1 Pro
// spent 2,303 tokens thinking on a weekly plan and proposed 1 task of 10.

import { assertEquals } from 'jsr:@std/assert@1';
import { GEMINI_MIN_OUTPUT_TOKENS, geminiGenerationConfig } from '../../_shared/ai.ts';

function withEnv(vars: Record<string, string>, fn: () => void) {
  for (const [k, v] of Object.entries(vars)) Deno.env.set(k, v);
  try { fn(); } finally { for (const k of Object.keys(vars)) Deno.env.delete(k); }
}

Deno.test("Ada's 2,400-token ask is raised so thinking cannot crowd out the reply", () => {
  assertEquals(geminiGenerationConfig('gemini-3.8-flash', 2400).maxOutputTokens, GEMINI_MIN_OUTPUT_TOKENS);
  assertEquals(geminiGenerationConfig('gemini-3.8-flash', 20000).maxOutputTokens, 20000);
  assertEquals(geminiGenerationConfig('gemini-3.8-flash').maxOutputTokens, GEMINI_MIN_OUTPUT_TOKENS);
});

Deno.test('Gemini 3 models think at a low level by default', () => {
  assertEquals(geminiGenerationConfig('gemini-3.8-flash', 2400).thinkingConfig, { thinkingLevel: 'low' });
  assertEquals(geminiGenerationConfig('gemini-3.1-pro-preview', 2400).thinkingConfig, { thinkingLevel: 'low' });
});

Deno.test('GEMINI_THINKING_LEVEL sets the level, and a typo or unsupported level falls back to low', () => {
  withEnv({ GEMINI_THINKING_LEVEL: 'Medium' }, () =>
    assertEquals(geminiGenerationConfig('gemini-3.8-flash').thinkingConfig, { thinkingLevel: 'medium' }));
  withEnv({ GEMINI_THINKING_LEVEL: 'minimal' }, () =>
    assertEquals(geminiGenerationConfig('gemini-3.8-flash').thinkingConfig, { thinkingLevel: 'low' }));
});

Deno.test('models that predate thinking levels, and -latest aliases, get no level', () => {
  assertEquals('thinkingConfig' in geminiGenerationConfig('gemini-2.5-flash', 2400), false);
  assertEquals('thinkingConfig' in geminiGenerationConfig('gemini-flash-latest', 2400), false);
});

Deno.test('ADA_THINKING_BUDGET overrides the level, never both at once', () => {
  withEnv({ ADA_THINKING_BUDGET: '0' }, () => {
    assertEquals(geminiGenerationConfig('gemini-3.8-flash').thinkingConfig, { thinkingBudget: 0 });
    assertEquals(geminiGenerationConfig('gemini-2.5-flash').thinkingConfig, { thinkingBudget: 0 });
  });
});
