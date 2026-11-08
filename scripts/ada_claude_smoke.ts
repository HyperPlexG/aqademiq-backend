// Live check of Ada's Claude path and Jev's tier pick, before deploying.
//
// Real API calls through the real code (sendAnthropic, claudeRequest,
// claudeResult, askJevTier), with an in-memory ledger so nothing touches the
// database. Costs well under $0.30. For each tier it sends the same tool-using
// request twice (the second should read the prompt from cache) and prints the
// time, the speed actually used, the cost, and whether the tool was called.
//
//   cd aqademiq-backend
//   read -s "ANTHROPIC_API_KEY?Anthropic key: " && echo && read -s "OPENROUTER_API_KEY?OpenRouter key: " && echo \
//     && export ANTHROPIC_API_KEY OPENROUTER_API_KEY \
//     && deno run --config supabase/functions/deno.json --allow-env --allow-read \
//          --allow-net=api.anthropic.com,openrouter.ai scripts/ada_claude_smoke.ts

import {
  anthropicEffort,
  anthropicFast,
  anthropicModel,
  type ClaudeTier,
  type Ledger,
  sendAnthropic,
} from '../supabase/functions/_shared/anthropic.ts';
import { claudeRequest, claudeResult } from '../supabase/functions/_shared/ai.ts';
import { askJevTier, jevTierConfig } from '../supabase/functions/api/agent/jev_tier.ts';

let spent = 0;
const ledger: Ledger = {
  reserve(usd) {
    spent += usd;
    return Promise.resolve('ok');
  },
  settle(delta) {
    spent += delta;
    return Promise.resolve();
  },
};

// Long enough (> 512 tokens) for the prompt cache to engage, like Ada's real prompt.
const RULES = Array.from({ length: 40 }, (_, i) =>
  `Rule ${i + 1}: propose changes only with the tools; never claim a change you did not propose; ` +
  'set a subject, tag or time only when the student gives one; keep replies short and warm.'
).join('\n');
const SYSTEM = `You are Ada, a study planner inside the Aqademiq app. Today is Saturday 7 November 2026.\n${RULES}`;
const TOOLS = [{
  name: 'create_task',
  description: 'Propose creating one task. For several tasks call this once per task.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'What the student will do.' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
    },
    required: ['title', 'date'],
  },
}];

async function once(tier: ClaudeTier, message: string) {
  const model = anthropicModel(tier);
  const fast = anthropicFast(tier, model);
  const p = { system: SYSTEM, messages: [{ role: 'user', content: message }], tools: TOOLS, maxTokens: 2400 };
  const started = Date.now();
  const json = await sendAnthropic(model, claudeRequest(p, anthropicEffort(tier)), {
    signal: AbortSignal.timeout(60_000),
    tier,
    fast,
    ledger,
  });
  const ms = Date.now() - started;
  const r = claudeResult(json, model, undefined, 'anthropic');
  const tool = r.content.find((b) => b.type === 'tool_use');
  console.log(
    `  ${tier.padEnd(6)} ${String(json.model).padEnd(18)} ${String(ms).padStart(6)} ms  speed=${json.usage?.speed ?? '-'}` +
      `  in=${json.usage?.input_tokens} cache_read=${json.usage?.cache_read_input_tokens ?? 0} out=${json.usage?.output_tokens}` +
      `  ${tool ? `→ ${tool.name}(${JSON.stringify(tool.input)})` : '(no tool)'}`,
  );
}

console.log('Claude, by tier (each twice: the second should read from cache):');
for (const tier of ['easy', 'middle', 'hard'] as ClaudeTier[]) {
  for (let i = 0; i < 2; i++) {
    try {
      await once(tier, 'Add "call mom" for tomorrow.');
    } catch (e) {
      console.log(`  ${tier} FAILED: ${(e as Error).message}`);
    }
  }
}
console.log(`Spent ≈ $${spent.toFixed(4)}`);

console.log('\nJev picks the tier:');
const cfg = jevTierConfig();
if (!cfg) {
  console.log('  OPENROUTER_API_KEY not set');
} else {
  for (const [msg, prev] of [
    ['what do I have tomorrow?', null],
    ['add call mom tomorrow and move my lab report to friday', null],
    ['plan my whole exam week: ML on Tue, OS on Thu, DBMS on Sat, I study best mornings', null],
    ['yes', 'Want me to plan your whole exam week around your three exams?'],
  ] as [string, string | null][]) {
    const t = await askJevTier(msg, prev, { ...cfg, timeoutMs: 10_000 });
    console.log(`  ${t ? `${t.tier.padEnd(6)} ${t.confidence.toFixed(2)}  ${t.ms} ms` : 'FAILED (rules would decide)'}  ← "${msg}"`);
  }
}
