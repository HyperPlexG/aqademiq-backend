// Replay past Ada runs through Jev, offline, and report how it compares.
//
// Same questions and the same comparison as the live shadow (jev_shadow.ts),
// so the two measure one thing. Nothing is written to the database.
//
//   1. Run scripts/jev/export_runs.sql (read-only) and save its JSON as runs.json,
//      somewhere outside the repo — it holds students' messages.
//   2. OPENROUTER_API_KEY=… deno run --config supabase/functions/deno.json \
//        --allow-read --allow-write --allow-env --allow-net=openrouter.ai \
//        scripts/jev/replay.ts runs.json report.md
//
// The report (and report.json beside it) also stays outside the repo.

import { decide, decideConfig, type DecideResult } from '../../supabase/functions/_shared/decide.ts';
import {
  compareShadow,
  type ShadowComparison,
  type ShadowInput,
  shadowQuestions,
} from '../../supabase/functions/api/agent/jev_shadow.ts';
import { chooseTier, type Tier } from '../../supabase/functions/api/agent/tiers.ts';

interface ExportedRun {
  run_id: string;
  created_at: string;
  goal: string;
  tier_line: string | null;
  reply: string | null;
  tags: Array<{ id: string; label: string }>;
  subjects: Array<{ id: string; name: string }>;
  proposals: Array<{ id: string; tool: string; title: string; args: Record<string, unknown>; status: string }>;
}

interface Outcome {
  run_id: string;
  rule_tier: Tier;
  rule_source: 'logged' | 'recomputed';
  result?: Pick<DecideResult, 'ms' | 'usage' | 'model'>;
  comparison?: ShadowComparison;
  statuses: Record<string, string>;
  error?: string;
}

const [inPath, outPath] = Deno.args;
if (!inPath || !outPath) {
  console.error('usage: replay.ts runs.json report.md');
  Deno.exit(2);
}
const cfg = decideConfig();
if (!cfg) {
  console.error('Set OPENROUTER_API_KEY (or JEV_API_KEY) first.');
  Deno.exit(2);
}

// The export is one JSON value; the SQL editor and execute_sql wrap it
// differently, so accept the array itself or a row holding it.
const raw = JSON.parse(await Deno.readTextFile(inPath));
const runs: ExportedRun[] = Array.isArray(raw)
  ? (raw.length === 1 && raw[0]?.runs ? raw[0].runs : raw)
  : raw.runs;
console.log(`${runs.length} runs`);

function ruleTier(r: ExportedRun): { tier: Tier; source: Outcome['rule_source'] } {
  const m = /^Tier: (easy|middle|hard)\b/.exec(r.tier_line ?? '');
  if (m) return { tier: m[1] as Tier, source: 'logged' };
  // Runs from before the tiers existed (26 Oct 2026): what the rules would
  // say now. previousRunFailed is unknown offline, so taken as false.
  return {
    tier: chooseTier({ goal: r.goal, hasAttachments: r.goal.includes('[Attached file(s)'), previousRunFailed: false }).tier,
    source: 'recomputed',
  };
}

async function one(r: ExportedRun): Promise<Outcome> {
  const { tier, source } = ruleTier(r);
  const statuses = Object.fromEntries(r.proposals.map((p) => [p.id, p.status]));
  const input: ShadowInput = {
    goal: r.goal,
    ruleTier: tier,
    subjects: r.subjects,
    tags: r.tags,
    proposals: r.proposals.map(({ id, tool, title, args }) => ({ id, tool, title, args: args ?? {} })),
    reply: r.reply ?? '',
  };
  try {
    const q = shadowQuestions(input);
    const res = await decide(q.state, q.questions, cfg!);
    return {
      run_id: r.run_id,
      rule_tier: tier,
      rule_source: source,
      result: { ms: res.ms, usage: res.usage, model: res.model },
      comparison: compareShadow(q, input, res),
      statuses,
    };
  } catch (e) {
    return { run_id: r.run_id, rule_tier: tier, rule_source: source, statuses, error: (e as Error).message };
  }
}

// A few at a time: rate limits are per organisation and unpublished.
const outcomes: Outcome[] = [];
for (let i = 0; i < runs.length; i += 4) {
  outcomes.push(...await Promise.all(runs.slice(i, i + 4).map(one)));
  console.log(`${outcomes.length}/${runs.length}`);
}

const ok = outcomes.filter((o) => o.comparison);
const ms = ok.map((o) => o.result!.ms).sort((a, b) => a - b);
const pct = (p: number) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : 0;
const cost = ok.reduce((s, o) => s + (o.result!.usage.cost ?? 0), 0);

const tierMatrix = new Map<string, number>();
for (const o of ok) {
  const k = `${o.rule_tier} → ${o.comparison!.tier.jev}`;
  tierMatrix.set(k, (tierMatrix.get(k) ?? 0) + 1);
}

// "Did the student ask for this card?" against what they did with it.
const named = new Map<string, number>();
const bucket = (n: number) => (n <= 0.3 ? 'not asked' : n >= 0.7 ? 'asked' : 'unsure');
for (const o of ok) {
  for (const c of o.comparison!.cards) {
    const k = `${bucket(c.named)} | ${o.statuses[c.id] ?? '?'}`;
    named.set(k, (named.get(k) ?? 0) + 1);
  }
}

function agreement(field: 'tag' | 'subject') {
  let n = 0, agree = 0, confidentDisagree = 0;
  for (const o of ok) {
    for (const c of o.comparison!.cards) {
      const v = c[field];
      if (!v) continue;
      n++;
      if (v.agree) agree++;
      else if (v.confidence >= 0.7) confidentDisagree++;
    }
  }
  return { n, agree, confidentDisagree };
}
const tag = agreement('tag');
const subject = agreement('subject');
const pctOf = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');

const lines = [
  `# Jev replay — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Model \`${cfg.model}\` via \`${cfg.url}\`. ${runs.length} runs, ${ok.length} answered, ${outcomes.length - ok.length} failed.`,
  `Latency p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms. Cost $${cost.toFixed(5)} in all.`,
  '',
  '## Tier (rules → Jev)',
  '',
  '| rules → Jev | runs |',
  '|---|---|',
  ...[...tierMatrix].sort().map(([k, v]) => `| ${k} | ${v} |`),
  '',
  `Agreement: ${pctOf(ok.filter((o) => o.comparison!.tier.agree).length, ok.length)}. ` +
  `(${ok.filter((o) => o.rule_source === 'recomputed').length} runs predate the tiers; their rule tier is recomputed.)`,
  '',
  '## "Did the student ask for this card?" vs what they did',
  '',
  '| Jev | card status | cards |',
  '|---|---|---|',
  ...[...named].sort().map(([k, v]) => `| ${k.split(' | ').join(' | ')} | ${v} |`),
  '',
  '"not asked" + rejected is a catch; "not asked" + approved/executed is a false alarm.',
  '',
  '## Tag and subject (Jev vs the chat model)',
  '',
  `- Tag: ${tag.n} cards, agree ${pctOf(tag.agree, tag.n)}, Jev confidently disagrees on ${tag.confidentDisagree}.`,
  `- Subject: ${subject.n} cards, agree ${pctOf(subject.agree, subject.n)}, Jev confidently disagrees on ${subject.confidentDisagree}.`,
  '',
  '## Failures',
  '',
  ...outcomes.filter((o) => o.error).slice(0, 20).map((o) => `- ${o.run_id}: ${o.error}`),
];

await Deno.writeTextFile(outPath, lines.join('\n') + '\n');
await Deno.writeTextFile(outPath.replace(/\.md$/, '') + '.json', JSON.stringify(outcomes, null, 2));
console.log(`wrote ${outPath}`);
