// Claude leads every tier when Anthropic's API is configured, and Jev picks the
// tier (_shared/ai.ts tierCandidates, agent/jev_tier.ts).
//
//   easy → Haiku 5.5, middle → Sonnet 5.5, hard → Opus 5, then GCP behind each.

import { assertEquals } from 'jsr:@std/assert@1';
import { tierCandidates } from '../../_shared/ai.ts';
import type { DecideConfig, DecideResult } from '../../_shared/decide.ts';
import { askJevTier, pickTier, tierState } from './jev_tier.ts';

function withEnv(extra: Record<string, string>, fn: () => void) {
  const set = {
    GCP_PROJECT_ID: 'aqademiq-test',
    GCP_SA_EMAIL: 'ada@aqademiq-test.iam.gserviceaccount.com',
    GCP_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----',
    GEMINI_API_KEYS: 'free-key-1',
    VERTEX_GEMINI_PRO_MODEL: 'gemini-pro-test',
    ANTHROPIC_API_KEY: 'sk-ant-test',
    ...extra,
  };
  for (const [k, v] of Object.entries(set)) Deno.env.set(k, v);
  try { fn(); } finally { for (const k of Object.keys(set)) Deno.env.delete(k); }
}

Deno.test('each tier leads with its Claude model, with the GCP order behind it', () => withEnv({}, () => {
  const easy = tierCandidates('easy');
  assertEquals(easy[0].id, 'anthropic:claude-haiku-5-5');
  assertEquals(easy[1].provider, 'gemini');
  const middle = tierCandidates('middle');
  assertEquals(middle[0].id, 'anthropic:claude-sonnet-5-5');
  assertEquals(middle[1].provider, 'vertex-gemini');
  const hard = tierCandidates('hard');
  assertEquals(hard[0].id, 'anthropic:claude-opus-5');
  assertEquals(hard[1].id, 'vertex-gemini:gemini-pro-test');
  // No tier (task breakdown, proactive notes) is the middle tier.
  assertEquals(tierCandidates(undefined)[0].id, 'anthropic:claude-sonnet-5-5');
}));

Deno.test('a tier model can be changed by secret', () => withEnv({ ANTHROPIC_HARD_MODEL: 'claude-opus-5-5' }, () => {
  assertEquals(tierCandidates('hard')[0].id, 'anthropic:claude-opus-5-5');
}));

Deno.test('without a key, or with ANTHROPIC_DIRECT=off, the GCP order is unchanged', () => {
  withEnv({ ANTHROPIC_DIRECT: 'off' }, () => assertEquals(tierCandidates('middle')[0].provider, 'vertex-gemini'));
  withEnv({}, () => {
    Deno.env.delete('ANTHROPIC_API_KEY');
    assertEquals(tierCandidates('middle')[0].provider, 'vertex-gemini');
  });
});

const RULES = { tier: 'middle' as const, reason: 'changes requested' };

Deno.test("Jev's tier wins when it is confident", () => {
  const pick = pickTier(RULES, false, { tier: 'hard', confidence: 0.83, ms: 210 }, 0.6);
  assertEquals(pick.tier, 'hard');
  assertEquals(pick.ruleTier, 'middle');
  assertEquals(pick.reason, 'jev 0.83; rules said middle (changes requested)');
});

Deno.test('the rules decide when Jev is unsure, missing, or the case is forced', () => {
  assertEquals(pickTier(RULES, false, { tier: 'easy', confidence: 0.41, ms: 200 }, 0.6).tier, 'middle');
  assertEquals(pickTier(RULES, false, null, 0.6).tier, 'middle');
  const forced = pickTier({ tier: 'hard', reason: 'file attached' }, true, { tier: 'easy', confidence: 0.99, ms: 1 }, 0.6);
  assertEquals(forced.tier, 'hard');
});

const cfg: DecideConfig = { url: 'https://jev.test', model: 'typesafe/jev-1.14', apiKey: 'k', timeoutMs: 100 };

Deno.test('askJevTier reads the choice, and never throws', async () => {
  const ok = (choice: string, confidence = 0.9) => () =>
    Promise.resolve({ model: 'm', ms: 180, usage: {}, answers: { tier: { type: 'choice', choice, confidence, probabilities: {} } } } as DecideResult);
  assertEquals(await askJevTier('plan my week', null, cfg, ok('hard')), { tier: 'hard', confidence: 0.9, ms: 180 });
  assertEquals(await askJevTier('plan my week', null, cfg, ok('impossible')), null);
  assertEquals(await askJevTier('plan my week', null, cfg, () => Promise.reject(new Error('timed out'))), null);
});

Deno.test("Jev reads Ada's last reply, so a bare yes has context", () => {
  const s = tierState('yes', 'Want me to plan your whole exam week?');
  assertEquals(s.includes('plan your whole exam week'), true);
  assertEquals(s.endsWith('yes'), true);
});
