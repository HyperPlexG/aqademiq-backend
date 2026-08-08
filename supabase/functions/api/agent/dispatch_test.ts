// Tests for the action-dispatch layer (tools.ts).
//
// This is the risky part of collapsing the tool surface: the model now calls
// `task_write` and something has to turn that back into `create_task` without
// disturbing parse, the confirmation gate, or the name written to
// ada_pending_actions. A mistake here is not a compile error — it is Ada
// silently losing the ability to write, or a pending row that can never be
// approved.
//
// Everything is exercised through the public surface (toolDefs/resolveCall/
// getTool), so the tests stay honest if the internals are reorganised.

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { getTool, isCallableName, kindOfCall, resolveCall, toolDefs } from './tools.ts';
import { ToolInputError } from './types.ts';

type Def = { name: string; description: string; input_schema: Record<string, unknown> };
type Schema = { properties?: Record<string, unknown>; required?: string[] };

const defs = toolDefs() as Def[];
const byName = new Map(defs.map((d) => [d.name, d]));

/** Declared groups, discovered rather than hardcoded, so a new one is covered too. */
function groups(): Array<{ name: string; key: string; values: string[] }> {
  const out = [];
  for (const d of defs) {
    const props = (d.input_schema as Schema).properties ?? {};
    for (const key of ['action', 'what']) {
      const spec = props[key] as { enum?: string[] } | undefined;
      if (spec?.enum?.length) out.push({ name: d.name, key, values: spec.enum });
    }
  }
  return out;
}

Deno.test('dispatch groups are actually declared', () => {
  const names = groups().map((g) => g.name).sort();
  assert(names.includes('task_write'), `task_write not declared. Got: ${names.join(', ')}`);
  assert(names.includes('get_reference'), `get_reference not declared. Got: ${names.join(', ')}`);
});

Deno.test('every declared action resolves to a real tool', () => {
  for (const g of groups()) {
    for (const value of g.values) {
      const { tool } = resolveCall(g.name, { [g.key]: value });
      assert(tool, `${g.name} ${g.key}="${value}" resolves to nothing — typo in the dispatch map.`);
    }
  }
});

Deno.test('the discriminator is stripped before parse sees it', () => {
  // Leaving `action` in would reach the sub-tool's parse as an unknown field.
  const { input } = resolveCall('task_write', { action: 'create', title: 'Read chapter 4' });
  assertEquals(input, { title: 'Read chapter 4' });
  assert(!('action' in input));
});

Deno.test('a missing or unknown action is a correctable ToolInputError', () => {
  // Not a crash: the runtime turns ToolInputError into an observation the model
  // fixes on the next turn, which is the whole reason a bad action is safe.
  const missing = assertThrows(() => resolveCall('task_write', {}), ToolInputError);
  assert(missing.message.includes('create'), 'error should list the valid actions');

  const unknown = assertThrows(
    () => resolveCall('task_write', { action: 'obliterate' }),
    ToolInputError,
  );
  assert(unknown.message.includes('obliterate'), 'error should echo what was tried');
  assert(unknown.message.includes('create'), 'error should list the valid actions');
});

Deno.test('non-dispatch names pass through untouched', () => {
  const { tool, input } = resolveCall('list_tasks', { from: '2026-08-09' });
  assertEquals(tool?.name, 'list_tasks');
  assertEquals(input, { from: '2026-08-09' });
});

Deno.test('collapsed tools are reachable by name but not declared', () => {
  // Both halves matter. Not declared: the model must not see six task tools
  // again, which is the entire saving. Still reachable: ada_pending_actions
  // stores the UNDERLYING name, so rows parked before the collapse — there were
  // 11 pending in production when this shipped — must still approve.
  for (const legacy of ['create_task', 'move_tasks', 'create_subject', 'list_subjects']) {
    assert(!byName.has(legacy), `${legacy} is still declared to the model.`);
    assert(getTool(legacy), `${legacy} is no longer resolvable — pending rows would break.`);
    assert(!isCallableName(legacy), `${legacy} should not be callable by the model.`);
  }
});

Deno.test('merged schema is the union of its sub-tools', () => {
  const props = ((byName.get('task_write')!.input_schema) as Schema).properties ?? {};
  // Fields that came from different sub-tools must all survive the merge.
  for (const field of ['title', 'task_id']) {
    assert(field in props, `task_write lost \`${field}\` in the merge.`);
  }
  // …and be declared exactly once, which is where the saving comes from.
  assertEquals(Object.keys(props).filter((k) => k === 'title').length, 1);
});

Deno.test('only the discriminator is required on a merged schema', () => {
  // A field required by `update` cannot be required by `delete`, so per-action
  // requirements live in the sub-tool's parse() instead.
  for (const g of groups()) {
    const req = ((byName.get(g.name)!.input_schema) as Schema).required ?? [];
    assertEquals(req, [g.key], `${g.name} should require only \`${g.key}\`.`);
  }
});

Deno.test('kindOfCall answers for dispatch names without parsing', () => {
  // The loop asks this before parse, to decide what may run concurrently.
  assertEquals(kindOfCall('task_write'), 'write');
  assertEquals(kindOfCall('get_reference'), 'read');
  assertEquals(kindOfCall('list_tasks'), 'read');
  assertEquals(kindOfCall('no_such_tool'), undefined);
});

Deno.test('writes never resolve to something the loop would run immediately', () => {
  // The confirmation gate keys off kind; a write group that resolved to a read
  // tool would execute against user data with no approval.
  for (const g of groups().filter((x) => x.name.endsWith('_write'))) {
    for (const value of g.values) {
      const { tool } = resolveCall(g.name, { [g.key]: value });
      assertEquals(tool?.kind, 'write', `${g.name}/${value} is not a write tool.`);
    }
  }
});
