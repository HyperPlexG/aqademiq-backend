// Which model a tier tries first (_shared/ai.ts). The order decides both the
// quality of the answer and who pays for it.

import { assertEquals } from 'jsr:@std/assert@1';
import { anthropicMessages, tierCandidates, withPinFirst } from '../../_shared/ai.ts';

function withEnv(fn: () => void) {
  const set = {
    GCP_PROJECT_ID: 'aqademiq-test',
    GCP_SA_EMAIL: 'ada@aqademiq-test.iam.gserviceaccount.com',
    GCP_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----',
    GEMINI_API_KEYS: 'free-key-1',
    GROQ_API_KEYS: 'gsk-test-1',
    VERTEX_GEMINI_PRO_MODEL: 'gemini-pro-test',
    VERTEX_CLAUDE_MODEL: 'claude-test',
  };
  for (const [k, v] of Object.entries(set)) Deno.env.set(k, v);
  try { fn(); } finally { for (const k of Object.keys(set)) Deno.env.delete(k); }
}

Deno.test('middle keeps the original order: Vertex Gemini first', () => withEnv(() => {
  assertEquals(tierCandidates('middle')[0].provider, 'vertex-gemini');
  assertEquals(tierCandidates(undefined)[0].provider, 'vertex-gemini');
}));

Deno.test('easy tries the free keys first, with Vertex behind them', () => withEnv(() => {
  const order = tierCandidates('easy').map((c) => c.provider);
  assertEquals(order[0], 'gemini');
  assertEquals(order[order.length - 1], 'vertex-gemini');
}));

Deno.test('hard leads with the chosen stronger model, then falls back to middle', () => withEnv(() => {
  const gemini = tierCandidates('hard', 'gemini');
  assertEquals(gemini[0].id, 'vertex-gemini:gemini-pro-test');
  assertEquals(gemini[1].provider, 'vertex-gemini');
  const claude = tierCandidates('hard', 'claude');
  assertEquals(claude[0].id, 'vertex-claude:claude-test');
  assertEquals(claude[1].provider, 'vertex-gemini');
}));

Deno.test('a run stays on the model it is pinned to', () => withEnv(() => {
  const order = tierCandidates('middle');
  const groq = order.find((c) => c.provider === 'groq')!;
  assertEquals(withPinFirst(order, groq.id)[0].id, groq.id);
  assertEquals(withPinFirst(order, 'not-in-list')[0].id, order[0].id);
}));

Deno.test('a transcript Gemini started is cleaned for Claude', () => {
  const out = anthropicMessages([
    { role: 'user', content: 'add two tasks' },
    {
      role: 'assistant',
      content: [
        { type: 'gemini_thought', text: 'hmm', thoughtSignature: 'sig' },
        { type: 'tool_use', id: 't1', name: 'task_write', input: { title: 'x' }, thoughtSignature: 'sig' },
      ],
    },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"ok":true}' }] },
  ]);
  assertEquals(out[1].content, [{ type: 'tool_use', id: 't1', name: 'task_write', input: { title: 'x' } }]);
  assertEquals(out[2].content[0].type, 'tool_result');
});
