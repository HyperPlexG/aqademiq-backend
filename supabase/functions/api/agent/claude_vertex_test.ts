// Claude on Vertex for the hard tier (_shared/ai.ts).
//
// Claude Opus 5.5 / Sonnet 5.5 always think, count thinking toward max_tokens,
// reject a forced tool, and refuse with an HTTP 200. Each of those used to reach
// Ada as an empty reply instead of moving the pool to the next model.

import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { CLAUDE_MIN_MAX_TOKENS, claudeRequest, claudeResult } from '../../_shared/ai.ts';

const tool = { name: 'task_write', description: 'Write a task', input_schema: { type: 'object', properties: {} } };

function withEffort(value: string | undefined, fn: () => void) {
  if (value === undefined) Deno.env.delete('VERTEX_CLAUDE_EFFORT');
  else Deno.env.set('VERTEX_CLAUDE_EFFORT', value);
  try { fn(); } finally { Deno.env.delete('VERTEX_CLAUDE_EFFORT'); }
}

Deno.test('the request leaves room for thinking and sets effort, not a thinking budget', () => withEffort(undefined, () => {
  // deno-lint-ignore no-explicit-any
  const body: any = claudeRequest({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [tool] as any, maxTokens: 2400 });
  assertEquals(body.max_tokens, CLAUDE_MIN_MAX_TOKENS);
  assertEquals(body.output_config, { effort: 'medium' });
  assertEquals(body.tool_choice, { type: 'auto' });
  assertEquals('thinking' in body, false);
  assertEquals('temperature' in body, false);
}));

Deno.test('effort comes from VERTEX_CLAUDE_EFFORT, and a typo falls back to medium', () => {
  // deno-lint-ignore no-explicit-any
  const effort = () => (claudeRequest({ system: 's', messages: [] }) as any).output_config.effort;
  withEffort('high', () => assertEquals(effort(), 'high'));
  withEffort(' XHigh ', () => assertEquals(effort(), 'xhigh'));
  withEffort('hgih', () => assertEquals(effort(), 'medium'));
});

Deno.test('a forced tool becomes auto plus an instruction', () => withEffort(undefined, () => {
  // deno-lint-ignore no-explicit-any
  const body: any = claudeRequest({
    system: 'sys',
    messages: [{ role: 'user', content: 'plan my week' }],
    // deno-lint-ignore no-explicit-any
    tools: [tool] as any,
    toolChoice: { type: 'tool', name: 'task_write' },
  });
  assertEquals(body.tool_choice, { type: 'auto' });
  assertEquals(body.system.endsWith('Answer by calling the `task_write` tool.'), true);
}));

Deno.test('thinking blocks are dropped and the tool call is kept', () => {
  const out = claudeResult({
    stop_reason: 'tool_use',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 't1', name: 'task_write', input: { title: 'x' } },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  }, 'claude-opus-5-5');
  assertEquals(out.content.map((b: { type: string }) => b.type), ['tool_use']);
  assertEquals(out.stop_reason, 'tool_use');
  assertEquals(out.usage?.model, 'claude-opus-5-5');
});

Deno.test('a refusal throws so the next model answers', () => {
  assertThrows(
    () => claudeResult({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, content: [] }, 'claude-opus-5-5'),
    Error,
    'refused (general_harms)',
  );
});

Deno.test('a reply that is only thinking, or cut off, throws', () => {
  assertThrows(
    () => claudeResult({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '  ' }] }, 'm'),
    Error,
    'nothing usable',
  );
  assertThrows(
    () => claudeResult({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'Here is your pl' }] }, 'm'),
    Error,
    'max_tokens',
  );
});

Deno.test('skipping a forced tool throws; calling it passes', () => {
  assertThrows(
    () => claudeResult({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure!' }] }, 'm', 'emit_breakdown'),
    Error,
    'did not call emit_breakdown',
  );
  const ok = claudeResult(
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'emit_breakdown', input: {} }] },
    'm',
    'emit_breakdown',
  );
  assertEquals(ok.stop_reason, 'tool_use');
});

Deno.test('a plain text answer still comes through', () => {
  const out = claudeResult({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] }, 'm');
  assertEquals(out.stop_reason, 'end_turn');
  assertEquals(out.content, [{ type: 'text', text: 'Done.' }]);
});
