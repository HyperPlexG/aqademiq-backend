// Ada prompt-size bench — measures what each Ada request actually costs, before
// and after an optimisation, without spending a single unit of provider quota.
//
// Why this exists: Ada's binding constraint is free-tier rate limits, so every
// optimisation has to be justified in tokens. Guessing is how you spend a day
// shaving 3% off a component while 54% sits untouched somewhere else. This
// imports the REAL tool registry and the REAL system prompt builder — not a
// copy — so a number here cannot drift from what ships.
//
// It is deliberately offline: `toolDefs()`, `renderContext()` and
// `systemPrompt()` are all pure, and `prismaBase()` is lazy, so nothing here
// opens a socket or reads the database.
//
//   deno run --allow-env --allow-read --allow-write agent/tokens_bench.ts
//   deno run ... agent/tokens_bench.ts --save          # record a baseline
//   deno run ... agent/tokens_bench.ts --compare       # diff against baseline
//   deno run ... agent/tokens_bench.ts --json          # machine-readable
//
// Two units are reported. **Characters are exact** — a delta in chars is ground
// truth. **Tokens are estimated** (±10%, see estimateTokens) because tokenising
// for real would mean a network call to the very API we are trying not to spend.
// For before/after work this is sound: the same estimator scores both sides.

import { toolDefs } from './tools.ts';
import { renderContext } from './context.ts';
import { systemPrompt } from './runtime.ts';
import type { AgentContext } from './context.ts';

const BASELINE_PATH = new URL('./token-baseline.json', import.meta.url);

// ---- estimation ----------------------------------------------------------

/**
 * Approximate BPE token count.
 *
 * Words are ~1.3 tokens each (common words are one token, rare ones split);
 * punctuation is ~0.7 (JSON's `":"` and `","` runs get merged by real BPE).
 * Counting punctuation separately is what makes this work on both prose and
 * JSON schema without needing to know which it is looking at.
 */
export function estimateTokens(s: string): number {
  if (!s) return 0;
  const words = s.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const punct = s.match(/[^\sA-Za-z0-9_]/g)?.length ?? 0;
  return Math.round(words * 1.3 + punct * 0.7);
}

// ---- fixture -------------------------------------------------------------

/**
 * A realistic mid-semester student, held fixed so runs are comparable.
 *
 * Not an empty account: an empty one hides exactly the costs that grow with
 * use (subjects, memories, insights, digest). Sized from what a second-year
 * user plausibly has after a month.
 */
export const FIXTURE: AgentContext = {
  today: '2026-08-09',
  now_local: '14:32',
  weekday: 'Sunday',
  timezone: 'Asia/Kolkata',
  user_name: 'Aswath',
  is_guest: false,
  active_semester: { id: '3f8a1c22-5b41-4e77-9a30-1d6e2f9b8c04', name: 'Semester 5 — Fall 2026' },
  subjects: [
    { id: '9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21', name: 'Digital Signal Processing' },
    { id: 'b47d2e19-8c60-4f35-a1e8-3d92f7c45a6b', name: 'Operating Systems' },
    { id: '1a5f8b03-6d24-4e91-b7c2-8f0a3e6d51c9', name: 'Microprocessors' },
    { id: 'e82c6d47-9a15-4b38-8e60-2c7f1b94d3a5', name: 'Control Systems' },
    { id: '5d3b9f21-4e78-4a06-9c13-7b2e8d05f6a4', name: 'Technical Communication' },
    { id: 'c60a7e35-1b92-4d84-a5f7-9e3d2c81b0f6', name: 'Design Project' },
  ],
  study_tags: [
    { id: 'a1b2c3d4-0001-4000-8000-000000000001', label: 'Deep work' },
    { id: 'a1b2c3d4-0002-4000-8000-000000000002', label: 'Revision' },
    { id: 'a1b2c3d4-0003-4000-8000-000000000003', label: 'Problem sets' },
    { id: 'a1b2c3d4-0004-4000-8000-000000000004', label: 'Lab prep' },
    { id: 'a1b2c3d4-0005-4000-8000-000000000005', label: 'Reading' },
  ],
  open_task_count: 23,
  awaiting_confirmation_count: 0,
  memories: [
    { id: 'm-01', kind: 'preference', content: 'Prefers deep work in the morning, before 11am', subject_id: null, source: 'user', confidence: 5 },
    { id: 'm-02', kind: 'constraint', content: 'Has lab every Tuesday 2-5pm', subject_id: null, source: 'user', confidence: 5 },
    { id: 'm-03', kind: 'pattern', content: 'Tends to abandon study sessions longer than 90 minutes', subject_id: null, source: 'ada', confidence: 3 },
    { id: 'm-04', kind: 'goal', content: 'Wants a 9.0 CGPA this semester', subject_id: null, source: 'user', confidence: 4 },
    { id: 'm-05', kind: 'constraint', content: 'Works a part-time job on Saturday mornings', subject_id: null, source: 'user', confidence: 4 },
    { id: 'm-06', kind: 'pattern', content: 'Consistently reschedules Control Systems problem sets', subject_id: 'e82c6d47-9a15-4b38-8e60-2c7f1b94d3a5', source: 'ada', confidence: 3 },
    { id: 'm-07', kind: 'preference', content: 'Likes 25-minute pomodoros over long blocks', subject_id: null, source: 'user', confidence: 4 },
    { id: 'm-08', kind: 'fact', content: 'DSP midterm is worth 30% of the final grade', subject_id: '9c1e4a70-2f83-4b16-8d55-6a7c0e3b9f21', source: 'user', confidence: 5 },
    { id: 'm-09', kind: 'constraint', content: 'No study after 11pm on weeknights', subject_id: null, source: 'user', confidence: 4 },
    { id: 'm-10', kind: 'pattern', content: 'Completes Operating Systems work ahead of schedule', subject_id: 'b47d2e19-8c60-4f35-a1e8-3d92f7c45a6b', source: 'ada', confidence: 3 },
    { id: 'm-11', kind: 'goal', content: 'Wants to finish the design project two weeks before the deadline', subject_id: null, source: 'user', confidence: 4 },
    { id: 'm-12', kind: 'preference', content: 'Prefers revision sessions scheduled the evening before a class', subject_id: null, source: 'ada', confidence: 3 },
  ],
  insights: {
    focus: {
      completed: 34,
      abandoned: 14,
      abandon_rate: 0.29,
      median_completed_mins: 42,
      median_abandoned_mins: 17,
      avg_interruptions: 1.4,
    },
    struggling: [
      { task_id: 'aa11bb22-cc33-4d44-8e55-ff6600771122', title: 'Control Systems problem set 4', moves: 5 },
      { task_id: 'bb22cc33-dd44-4e55-8f66-001122334455', title: 'DSP lab report', moves: 3 },
    ],
    backlog: [
      { subject: 'Control Systems', overdue: 4 },
      { subject: 'Technical Communication', overdue: 2 },
    ],
  },
  digest: [
    'Created "DSP revision block" on Monday 09:00-10:30.',
    'Moved "Control Systems problem set 4" to Thursday.',
    'User declined moving the Design Project checkpoint.',
  ],
  readable_file_count: 2,
};

/**
 * A representative agent loop, used to project per-run cost.
 *
 * Values are **tokens**, not characters. They were briefly characters, fed
 * through estimateTokens('x'.repeat(n)) — which counts a run of x's as ONE word
 * and so valued every turn at ~1 token, silently reporting history as free.
 * Sizes come from the shape of real observations: a `list_tasks` dump is large,
 * a write proposal's echo is small.
 *
 * These are the same eight tool calls the run has always made, now batched into
 * the three round trips the turn cap allows. That distinction is the point:
 * batching does not reduce the WORK, it reduces how many times the invariant
 * prefix (tools + system, the bulk of every request) is re-uploaded. Totals are
 * held at 625 assistant / 1,314 observation tokens so a before/after delta
 * reflects only that.
 */
const TURNS: Array<{ label: string; assistant: number; observation: number }> = [
  { label: 'record_plan + list_tasks', assistant: 145, observation: 757 },
  { label: 'list_free_time + get_reference', assistant: 66, observation: 408 },
  { label: 'task_write ×3 + remember + finish', assistant: 414, observation: 149 },
];

// ---- measurement ---------------------------------------------------------

export interface Component {
  name: string;
  chars: number;
  tokens: number;
}

export interface Measurement {
  components: Component[];
  tools: { count: number; chars: number; tokens: number; perTool: Component[] };
  /** Prefix that is byte-identical between two requests a minute apart. */
  cache: { stableTokens: number; volatileTokens: number; stablePct: number };
  run: { calls: number; promptTokens: number; repeatedTokens: number; historyTokens: number; toolShare: number };
  totalPerCall: number;
}

export function measure(ctx: AgentContext = FIXTURE): Measurement {
  const defs = toolDefs();
  const perTool = defs
    .map((d) => {
      const json = JSON.stringify(d);
      return { name: d.name, chars: json.length, tokens: estimateTokens(json) };
    })
    .sort((a, b) => b.tokens - a.tokens);

  const toolsJson = JSON.stringify(defs);
  const tools = {
    count: defs.length,
    chars: toolsJson.length,
    tokens: estimateTokens(toolsJson),
    perTool,
  };

  const contextBlock = renderContext(ctx);
  const full = systemPrompt(contextBlock);
  // The static half is everything systemPrompt() adds around the context block.
  const staticSystem = full.slice(0, full.length - contextBlock.length);

  const components: Component[] = [
    { name: 'tool definitions', chars: tools.chars, tokens: tools.tokens },
    { name: 'system: static rules', chars: staticSystem.length, tokens: estimateTokens(staticSystem) },
    { name: 'system: context block', chars: contextBlock.length, tokens: estimateTokens(contextBlock) },
  ];

  // --- cache split ---
  // Caching is a strict prefix match, so the reusable part ends at the FIRST
  // byte that differs between two requests — not the last. Several things in the
  // context block vary; the boundary is whichever appears earliest.
  //
  // Ranked by how fast each moves: the clock changed every minute (until it was
  // moved out to the user turn), the digest changes per run, and the open-task
  // count changes whenever a task is ticked off.
  const volatileMarkers = [
    ctx.now_local, // per-minute — should no longer be present
    'Earlier in this conversation:', // per-run
    `Open (pending) tasks: ${ctx.open_task_count}`, // per-task-completion
  ];
  const boundary = volatileMarkers
    .map((m) => full.indexOf(m))
    .filter((i) => i >= 0)
    .reduce((min, i) => Math.min(min, i), full.length);
  const stableTokens = estimateTokens(full.slice(0, boundary)) + tools.tokens;
  const volatileTokens = estimateTokens(full.slice(boundary));
  const cache = {
    stableTokens,
    volatileTokens,
    stablePct: Math.round((stableTokens / (stableTokens + volatileTokens)) * 100),
  };

  // --- per-run projection ---
  const perCall = components.reduce((n, c) => n + c.tokens, 0);
  let transcript = 0;
  let historyTokens = 0;
  for (const t of TURNS) {
    historyTokens += transcript;
    transcript += t.assistant + t.observation;
  }
  // The invariant prefix — tools + system — re-uploaded verbatim on every call.
  // This is the number an optimisation actually moves; history is the same
  // regardless of how the tools are declared.
  const repeatedTokens = perCall * TURNS.length;
  const promptTokens = repeatedTokens + historyTokens;
  const run = {
    calls: TURNS.length,
    promptTokens,
    repeatedTokens,
    historyTokens,
    toolShare: Math.round(((tools.tokens * TURNS.length) / promptTokens) * 100),
  };

  return { components, tools, cache, run, totalPerCall: perCall };
}

// ---- reporting -----------------------------------------------------------

const n = (v: number) => v.toLocaleString('en-US');
const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

function report(m: Measurement): string {
  const out: string[] = [];
  const total = m.totalPerCall;

  out.push('');
  out.push('Ada prompt size — per provider call');
  out.push('─'.repeat(64));
  out.push(`${pad('component', 26)}${padL('chars', 10)}${padL('~tokens', 10)}${padL('share', 8)}`);
  out.push('─'.repeat(64));
  for (const c of m.components) {
    const pct = ((c.tokens / total) * 100).toFixed(1) + '%';
    out.push(`${pad(c.name, 26)}${padL(n(c.chars), 10)}${padL(n(c.tokens), 10)}${padL(pct, 8)}`);
  }
  out.push('─'.repeat(64));
  out.push(`${pad('TOTAL (before history)', 26)}${padL('', 10)}${padL(n(total), 10)}`);
  out.push('');

  out.push(`Projected run — ${m.run.calls} calls, history growing each turn`);
  out.push('─'.repeat(64));
  out.push(`  prompt tokens per run      ${n(m.run.promptTokens)}`);
  out.push(`    repeated prefix          ${n(m.run.repeatedTokens)}  (tools + system, re-sent every call)`);
  out.push(`    growing history          ${n(m.run.historyTokens)}`);
  out.push(`  spent re-sending tools     ${n(m.tools.tokens * m.run.calls)}  (${m.run.toolShare}% of the run)`);
  out.push('');

  out.push('Cache prefix (what survives between two requests a minute apart)');
  out.push('─'.repeat(64));
  out.push(`  stable   ${padL(n(m.cache.stableTokens), 7)}  ${m.cache.stablePct}%`);
  out.push(`  volatile ${padL(n(m.cache.volatileTokens), 7)}  ${100 - m.cache.stablePct}%`);
  out.push('');

  out.push(`Ten largest tools (of ${m.tools.count})`);
  out.push('─'.repeat(64));
  for (const t of m.tools.perTool.slice(0, 10)) {
    out.push(`  ${pad(t.name, 32)}${padL(n(t.tokens), 8)}`);
  }
  const rest = m.tools.perTool.slice(10).reduce((a, t) => a + t.tokens, 0);
  out.push(`  ${pad(`… ${m.tools.count - 10} more`, 32)}${padL(n(rest), 8)}`);
  out.push('');
  return out.join('\n');
}

function diff(before: Measurement, after: Measurement): string {
  const out: string[] = [];
  const row = (label: string, b: number, a: number) => {
    const d = a - b;
    const pct = b === 0 ? '—' : `${d >= 0 ? '+' : ''}${((d / b) * 100).toFixed(1)}%`;
    const sign = d > 0 ? '+' : '';
    return `${pad(label, 30)}${padL(n(b), 10)}${padL(n(a), 10)}${padL(sign + n(d), 10)}${padL(pct, 9)}`;
  };

  out.push('');
  out.push('Before → after');
  out.push('─'.repeat(70));
  out.push(`${pad('', 30)}${padL('before', 10)}${padL('after', 10)}${padL('delta', 10)}${padL('', 9)}`);
  out.push('─'.repeat(70));
  for (const c of after.components) {
    const b = before.components.find((x) => x.name === c.name);
    out.push(row(c.name, b?.tokens ?? 0, c.tokens));
  }
  out.push('─'.repeat(70));
  out.push(row('per call', before.totalPerCall, after.totalPerCall));
  out.push(row('per run', before.run.promptTokens, after.run.promptTokens));
  out.push(row('  repeated prefix', before.run.repeatedTokens ?? 0, after.run.repeatedTokens));
  out.push(row('cacheable prefix', before.cache.stableTokens, after.cache.stableTokens));
  out.push(row('tool count', before.tools.count, after.tools.count));
  out.push('');

  const saved = before.run.promptTokens - after.run.promptTokens;
  if (saved > 0) {
    out.push(`Saves ${n(saved)} prompt tokens per Ada message ` +
      `(${((saved / before.run.promptTokens) * 100).toFixed(1)}%).`);
  } else if (saved < 0) {
    out.push(`⚠ Costs ${n(-saved)} MORE prompt tokens per Ada message.`);
  } else {
    out.push('No change.');
  }
  out.push('');
  return out.join('\n');
}

// ---- cli -----------------------------------------------------------------

if (import.meta.main) {
  const args = new Set(Deno.args);
  const m = measure();

  if (args.has('--json')) {
    console.log(JSON.stringify(m, null, 2));
  } else if (args.has('--save')) {
    await Deno.writeTextFile(BASELINE_PATH, JSON.stringify(m, null, 2) + '\n');
    console.log(report(m));
    console.log(`Baseline written to ${BASELINE_PATH.pathname.split('/').pop()}. ` +
      `Commit it, make your change, then run with --compare.`);
  } else if (args.has('--compare')) {
    let before: Measurement;
    try {
      before = JSON.parse(await Deno.readTextFile(BASELINE_PATH));
    } catch {
      console.error('No baseline found. Run with --save first (on the unoptimised code).');
      Deno.exit(1);
    }
    console.log(report(m));
    console.log(diff(before, m));
  } else {
    console.log(report(m));
  }
}
