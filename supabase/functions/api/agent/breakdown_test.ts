// Tests for the anti-boilerplate guard on task breakdown.
//
// The complaint this exists to fix: breakdowns came out generic. Three things
// caused that — the fallback was literally `Plan X / Work on X / Review X`, the
// model was handed a bare title with no subject or notes, and the agent (which
// has all that context) delegated to it anyway.
//
// The first two are fixed by construction. This covers the third defence: a set
// of steps that says nothing is REJECTED rather than written into the user's
// plan, both when a small model emits it (claude.breakdownSteps) and when the
// agent proposes it (breakdown_task's parse).
//
// The guard has to fail in the right direction. Flagging a real breakdown is
// worse than letting a weak step through, because a rejected proposal costs the
// user their turn — so the tolerance is deliberately asymmetric and is asserted
// here, not just the obvious positive cases.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { isBoilerplate } from '../../_shared/claude.ts';

const steps = (...titles: string[]) => titles.map((title) => ({ title, duration_seconds: 0 }));

Deno.test('the exact template that shipped is rejected', () => {
  // What fallbackStepRows used to produce, verbatim.
  assert(
    isBoilerplate(
      steps('Plan: Lab report', 'Work on Lab report', 'Review Lab report'),
      'Lab report',
    ),
  );
});

Deno.test('restating the task title is not a step', () => {
  assert(isBoilerplate(steps('Lab report', 'Lab report again'), 'Lab report'));
});

Deno.test('generic verbs with nothing after them are rejected', () => {
  assert(isBoilerplate(steps('Start', 'Continue', 'Finish'), 'DSP assignment'));
});

Deno.test('punctuation and case do not hide boilerplate', () => {
  assert(
    isBoilerplate(
      steps('PLAN — “Control Systems PS4”', 'work on control systems ps4!'),
      'Control Systems PS4',
    ),
  );
});

Deno.test('a real breakdown passes', () => {
  assertEquals(
    isBoilerplate(
      steps(
        'Derive the transfer function for the RLC network',
        'Sketch the Bode plot and mark the gain margin',
        'Check the steady-state error against the spec',
      ),
      'Control Systems problem set 4',
    ),
    false,
  );
});

Deno.test('a generic verb is fine when real work follows it', () => {
  // "Do a timed past paper…" is a genuine instruction. Rejecting it because it
  // starts with a common verb would be the guard failing in the wrong
  // direction — these are exactly the strings the type-aware fallback emits.
  assertEquals(
    isBoilerplate(
      steps(
        'Do a timed past paper under exam conditions',
        'Check your answers against the mark scheme',
        'Work through the topics you dropped marks on',
      ),
      'Microprocessors revision',
    ),
    false,
  );
});

Deno.test('one weak step does not condemn a real plan', () => {
  assertEquals(
    isBoilerplate(
      steps(
        'Review',
        'Draft the discussion section from the lab notes',
        'Plot the frequency response from the CSV',
      ),
      'DSP lab report',
    ),
    false,
  );
});

Deno.test('mostly-filler is rejected even with one real step', () => {
  assert(
    isBoilerplate(
      steps('Plan: DSP lab report', 'Plot the frequency response', 'Review DSP lab report'),
      'DSP lab report',
    ),
  );
});

Deno.test('the type-aware fallback is never self-rejected', () => {
  // These are persisted when the model is unavailable, so if the guard flagged
  // them the breakdown would fail outright instead of degrading.
  const fallbacks = [
    steps(
      'Decide the argument and jot the section headings',
      'Draft the body sections from your notes',
      'Tighten the intro and conclusion, then proofread',
    ),
    steps(
      'Read the questions and mark which need which technique',
      'Work the straightforward questions first',
      'Attack the ones you flagged, then check your answers',
    ),
    steps(
      'List the topics on the syllabus and rate your confidence',
      'Work through the weakest topics with practice questions',
      'Do a timed past paper under exam conditions',
    ),
  ];
  for (const set of fallbacks) {
    assertEquals(isBoilerplate(set, 'Essay on market failure'), false, set[0].title);
  }
});
