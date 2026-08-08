// Guards the prompt budget.
//
// Ada's binding constraint is free-tier rate limits, and tool definitions are
// re-sent on every provider call — so a tool added carelessly is not paid once,
// it is paid ~8 times per Ada message, forever. Nothing else in the codebase
// makes that cost visible at review time, which is how the surface grew to 70%
// of every request without anyone deciding it should.
//
// These ceilings are a ratchet, not a target. Raising one is allowed, but it
// should be a deliberate line in a diff rather than a silent drift.

import { assert } from 'jsr:@std/assert@1';
import { measure } from './tokens_bench.ts';

/** Whole-registry ceiling. Lower this as the surface is collapsed. */
const MAX_TOOL_TOKENS = 4_200;

/** No single tool should dominate. `create_task` is the current worst, at ~434. */
const MAX_SINGLE_TOOL_TOKENS = 500;

/**
 * Tools must not outgrow everything else combined by more than 3×. This catches
 * the failure mode the absolute ceilings miss: shrinking the prompt elsewhere
 * while the tool surface stays fat.
 */
const MAX_TOOL_SHARE = 0.75;

Deno.test('tool registry stays within its token budget', () => {
  const m = measure();
  assert(
    m.tools.tokens <= MAX_TOOL_TOKENS,
    `Tool definitions are ~${m.tools.tokens} tokens, over the ${MAX_TOOL_TOKENS} ceiling. ` +
      `They are re-sent on every provider call (~${m.run.calls}× per Ada message), so this ` +
      `costs ~${m.tools.tokens * m.run.calls} tokens per message. Before raising the ceiling, ` +
      `check whether the new tool can fold into an existing action-dispatch tool. ` +
      `Run: deno run --allow-env --allow-read --allow-write api/agent/tokens_bench.ts`,
  );
});

Deno.test('no single tool dominates the registry', () => {
  const m = measure();
  const worst = m.tools.perTool[0];
  assert(
    worst.tokens <= MAX_SINGLE_TOOL_TOKENS,
    `Tool "${worst.name}" is ~${worst.tokens} tokens, over the ${MAX_SINGLE_TOOL_TOKENS} ceiling. ` +
      `Trim its description or flatten its input_schema — verbose enum lists and per-field ` +
      `descriptions are usually the cause.`,
  );
});

Deno.test('tool definitions do not crowd out the rest of the prompt', () => {
  const m = measure();
  const share = m.tools.tokens / m.totalPerCall;
  assert(
    share <= MAX_TOOL_SHARE,
    `Tool definitions are ${(share * 100).toFixed(1)}% of every call, over the ` +
      `${MAX_TOOL_SHARE * 100}% ceiling. The context and instructions that make Ada useful ` +
      `are being squeezed by schema JSON.`,
  );
});

Deno.test('the bench fixture still reflects a real context', () => {
  const m = measure();
  // A fixture that silently degrades to empty would make every measurement
  // look great and mean nothing.
  const ctxBlock = m.components.find((c) => c.name === 'system: context block');
  assert(ctxBlock && ctxBlock.tokens > 300, 'Bench fixture has gone empty — measurements are meaningless.');
  assert(m.tools.count >= 20, `Only ${m.tools.count} tools found — the registry import is broken.`);
});
