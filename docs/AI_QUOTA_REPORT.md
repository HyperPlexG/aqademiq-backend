# Ada AI quota report: why this backend hits 429s and aqademiq-app does not

Status: diagnosis complete. Code changes applied (Steps 2-6); Steps 0, 1 and 7 are
operator actions that need deployed-environment and database access.
Constraint for all work here: **stay on the Gemini free tier** (no billing).

---

## 1. The short answer

The two projects are not comparable on quota, because **`aqademiq-app` never consumes your Gemini quota at all.**

| | `aqademiq-app` (old) | `aqademiq-backend` (new) |
|---|---|---|
| Endpoint | `ai.gateway.lovable.dev/v1/chat/completions` | `generativelanguage.googleapis.com/v1beta` |
| Credential | `LOVABLE_API_KEY` (Lovable's paid capacity) | `GEMINI_API_KEYS` (your free-tier AI Studio keys) |
| Model calls per user message | **1-2** | **up to 8** |
| Extra calls after user approves an action | none | up to 8 more (resume run) |
| Prompt tokens per message | ~2.5k-6k | **~55k across a full run** |
| Tool surface sent per call | 5 tools, as prompt text | 17 tools, full JSON schemas, re-sent every turn |
| Failure mode when exhausted | HTTP 402 (credits) | HTTP 429 `RESOURCE_EXHAUSTED` |

There is no `GEMINI_API_KEY` anywhere in the `aqademiq-app` repo. Its Gemini traffic is billed to Lovable, on Lovable's enterprise-grade Google quota. It cannot produce the error you are seeing.

### The arithmetic that causes your 429s

Free-tier Flash is roughly **15 requests per minute, per Google Cloud project**. At 8 calls per user message:

```
15 RPM / 8 calls per message = ~2 messages per minute, per account
```

The old project spends 1-2 calls for the same message, so it would need roughly 4x your traffic to feel any pressure even if it were on your quota.

**This is a request-count problem, not a token-size problem.** RPM and RPD are counted in requests. Trimming prompts helps tokens-per-minute, latency, and cost, but it will not fix a 429 caused by request frequency. Calls-per-message is the lever that resolves the error.

---

## 2. Evidence

### 2.1 The old project proxies through Lovable

```ts
// aqademiq-app/supabase/functions/agent/index.ts:537-540
const apiUrl = useGemini
  ? "https://ai.gateway.lovable.dev/v1/chat/completions"
  : "https://api.openai.com/v1/chat/completions";
const model = useGemini ? "google/gemini-2.5-flash" : "gpt-4o-mini";
```

Its loop is capped at two iterations: one planner call, plus one reflection call only when a tool actually executed.

```ts
// aqademiq-app/supabase/functions/agent/index.ts:584
const MAX_ITERATIONS = 2;
```

Context per request is small: 12 messages of history, 10 memory rows, 5 tools described as plain text (not native function-calling).

### 2.2 This backend calls Google directly, up to 8 times per message

```ts
// supabase/functions/api/agent/runtime.ts:31-38
const MAX_TURNS = 8;
const MAX_RESUME_TURNS = 5;
const HISTORY_LIMIT = 16;
const MAX_OBSERVATION_CHARS = 6000;
const MAX_TOKENS = 2400;

// runtime.ts:64
const MAX_LLM_CALLS = intEnv('ADA_MAX_LLM_CALLS', 8);
```

Every turn is a separate HTTP request that replays the entire transcript plus the whole tool surface:

```ts
// supabase/functions/api/agent/runtime.ts:385
const tools = [PLAN_TOOL, FINISH_TOOL, ...toolDefs()];
```

The code already documents the consequence:

```
// runtime.ts:47-51
// The provider pool is free-tier: quota is consumed per CALL, and because the
// loop is stateless (the whole transcript is replayed every turn) turn N costs
// roughly N times the base prompt. So a run's cost grows superlinearly in the
// number of calls
```

### 2.3 The measured cost, from our own bench

`supabase/functions/api/agent/token-baseline.json`:

| Component | Tokens |
|---|---|
| Tool definitions | 4,054 |
| System static rules | 875 |
| Context block | 818 |
| **Per call** | **5,747** |
| **Per 8-call run** | **54,685 prompt tokens** |
| Re-sent tool share of a run | **59%** |

### 2.4 Where the extra calls come from

One user message can cost more than the 8 loop calls:

- **Resume run.** After the user approves a pending action, `resumeRun` starts a fresh phase with its own clock and its own call allowance (`MAX_RESUME_TURNS = 5`). It deliberately does not inherit the first phase's spent budget.
- **File extraction.** Each uncached file opened by `read_file` costs its own multimodal call (`files.ts` reserves it via `reserveCall()`).
- **Task breakdown.** Approving `breakdown_task` triggers `claude.breakdownSteps`, one more call outside the agent budget.
- **Proactive nudges.** `agent/proactive.ts` runs a full `runAgent()` per eligible user, up to 3 users per sweep at `ADA_NUDGE_MAX_CALLS` (4) each, driven by the every-minute `POST /cron/notifications` job. Gated by `ADA_NUDGES_ENABLED=1`.

### 2.5 Key rotation is working, but two things blunt it

Rate limits are enforced **per Google Cloud project, not per API key**. Since our keys come from separate Google accounts, each carries its own bucket and the pool in `_shared/ai.ts` genuinely multiplies capacity. Two caveats:

1. **Cooldowns may not be shared.** When Upstash is unavailable, the bench falls back to a per-isolate map:

   ```ts
   // supabase/functions/_shared/ai.ts:123-125
   /** id → epoch ms when the bench expires. Mirrors the Redis TTL for isolates
    *  that have no Upstash configured, or when a lookup fails. */
   const memCooldown = new Map<string, number>();
   ```

   Supabase Edge runs many isolates, so a key benched in one is immediately retried by the others. That is the "All AI keys failed" pattern described in the comments at `ai.ts:109-114`.

2. **One run can bench several keys.** `rotatingChat` is invoked per call and rotates by a random start index, so the 8 calls of a single run spread across the pool. A burst therefore trips 429s on multiple accounts at once. Reducing calls-per-run fixes this as a side effect.

### 2.6 Thinking tokens are uncapped

`geminiChat` sets only an output cap:

```ts
// supabase/functions/_shared/ai.ts:406-410
const body: any = {
  systemInstruction: { parts: [{ text: p.system }] },
  contents,
  generationConfig: { maxOutputTokens: p.maxTokens ?? 2048 },
};
```

No `thinkingConfig`, so the default `gemini-flash-latest` alias applies its dynamic thinking budget. The adapter already folds those tokens into recorded spend:

```ts
// supabase/functions/_shared/ai.ts:469-472
usage: {
  prompt_tokens: Number(um.promptTokenCount ?? 0),
  completion_tokens: Number(um.candidatesTokenCount ?? 0) + Number(um.thoughtsTokenCount ?? 0),
```

The real damage is latency, not tokens. Slow calls trip the 24s `RUN_DEADLINE_MS`, and a run cut short has already paid quota for every call it made.

### 2.7 There is no per-user budget

The old app had two product-level guards this backend lacks entirely: a 50,000 token/day quota enforced in `ai-chat`, and a 10-message client-side cap. Here, nothing stops one active user from draining the shared key pool for everybody.

---

## 3. Resolution steps

Ordered by impact on the 429 itself. Steps 0-3 resolve the error; steps 4-6 reduce token usage and protect the fix.

### Step 0: rule out the proactive cron and check Redis

Before changing any code, confirm two things in the deployed Edge secrets.

- **`ADA_NUDGES_ENABLED` must be unset.** If it is `1`, the every-minute sweep spends up to 12 calls/minute (3 users x 4 calls) before any user types a word. On a free-tier pool that alone can explain the exhaustion.
- **`UPSTASH_*` must be set.** Without it, key cooldowns are per-isolate (see 2.5) and benched keys get hammered repeatedly.

Effort: minutes. This may be the entire cause.

### Step 1: measure the real call distribution

Do not guess at new caps. The telemetry already exists: `ada_agent_runs` stores `llm_calls`, `prompt_tokens`, `completion_tokens` and `stopped_reason`, written on every exit path including failures (`persistRun`, `runtime.ts:540-559`). Queries live in `scripts/sql/ada-token-cost.sql`.

Get:
- the percentile distribution of `llm_calls` per run (p50, p90, p99),
- the share of runs with `stopped_reason IS NOT NULL`, split by `deadline` vs `call_budget`,
- per-key attribution via `key_id`, to confirm load is spreading across accounts.

If p90 is 3-4 calls, capping at 4 costs nothing. If many runs stop on `deadline`, Step 3 (thinking) matters more than Step 2.

### Step 2: cut calls per message

This is the fix for the 429. In `supabase/functions/api/agent/runtime.ts`:

- `MAX_TURNS` 8 -> 4, `MAX_LLM_CALLS` 8 -> 4, `MAX_RESUME_TURNS` 5 -> 2. All three are now env-overridable (`ADA_MAX_TURNS`, `ADA_MAX_LLM_CALLS`, `ADA_MAX_RESUME_TURNS`) so the right number can be tuned from measurement without a redeploy.
- **The model now sees its remaining budget.** The prompt told it to work in few turns but never said how few were left, so a run would spend its last affordable call on one more read and get cut off before replying. Each batch of observations now carries `[BUDGET: n calls left]`, and `[BUDGET: this is your final call...]` at one.

  This rides on the last observation rather than travelling as its own text block, because a text block in a user turn is silently dropped by *both* the Gemini and Cerebras adapters (they map only `tool_result` blocks), and a second consecutive user message is rejected outright by Anthropic.
- The prompt now asks for `finish` in the same turn as the writes, and `FINISH_TOOL`'s own description says so too. A proposed change needs no follow-up read to confirm it, so a dedicated closing round trip was pure waste.

### Step 3: widen free-tier capacity without paying (DONE)

Free-tier RPM and RPD are enforced **per model per project**, so one key can draw on two independent buckets.

`KeyEntry` now carries a `model`, and `pool()` emits one entry per key-model pair from the new `GEMINI_MODELS` / `CEREBRAS_MODELS` secrets. The cooldown `id` includes the model, so benching a key for Flash leaves it usable for Flash-Lite. `rotatingChat` reads `c.model` rather than recomputing one per provider.

Unset, the plural secrets fall back to the existing singular `GEMINI_MODEL` / `CEREBRAS_MODEL`, so **nothing changes until you opt in.** To roughly double daily capacity per account:

```
GEMINI_MODELS=gemini-2.5-flash-lite,gemini-flash-latest
```

Flash-Lite is listed first deliberately: it runs at roughly 30 RPM against Flash's 15 at the same daily ceiling.

### Step 4: cap thinking (DONE, opt-in)

`geminiChat` now sends `thinkingConfig: { thinkingBudget: n }` when `ADA_THINKING_BUDGET` is set. Thinking is billed as output and is slow, and a slow turn trips the 24s deadline, which throws away every call the run has already paid for.

**Unset sends no `thinkingConfig` at all** — the provider default, and the previous behaviour. That default is deliberate rather than lazy: not every Gemini model accepts a budget of 0, and a rejected `generationConfig` fails the whole request. Set `ADA_THINKING_BUDGET=0` once you have confirmed your pinned model accepts it.

The existing `gemini_thought` replay logic is untouched. It exists because Gemini rejects a continuation whose `functionCall` parts lost their `thoughtSignature`, and that is still required whenever thinking is on.

### Step 5: reduce tokens per call (PARTIALLY DONE)

Done: `HISTORY_LIMIT` 16 -> 8 (env `ADA_HISTORY_LIMIT`) and `MAX_OBSERVATION_CHARS` 6000 -> 4000.

`MAX_OBSERVATION_CHARS` landed at 4000 rather than the 2500 originally proposed. A `list_tasks` dump for a normal mid-semester user measures ~745 tokens, i.e. ~2,300 characters, so a 2,500 ceiling would have started truncating real task lists — degrading Ada's answers to save tokens she actually needs.

**Not done, deliberately: gating write tools until turn 2.** On closer reading this is counterproductive now that runs are capped at 4 turns. The most common request ("remind me to submit X tomorrow") is ideally a single turn of `task_write` + `finish`; withholding the write surface would force it into two, spending exactly the request we are trying to save. It trades a token saving for a request increase, and requests are what the 429 counts.

**Not done: trimming the fattest tool descriptions.** `task_write` (672 tokens) and `remember` (338) are the obvious targets, but those descriptions are how the model knows which `action` to pick and what belongs in memory. The saving is a few hundred tokens per call against a real risk of behavioural regression, so it wants its own change with its own testing rather than riding along here.

### Step 6: per-user daily budget (DONE)

`postMessage` now refuses politely once a user has spent `ADA_DAILY_CALL_CAP` provider calls in a UTC day, counted by aggregating `ada_agent_runs.llm_calls`. Default 200, roughly 50 messages a day at the new run budget; `0` disables it.

The check **fails open** — if the aggregate query throws, Ada answers anyway, because a telemetry query being down is not a good enough reason to refuse someone their assistant. Refusing here rather than letting the provider 429 mid-run also means quota is not spent on a run that dies, and the user gets a plain explanation instead of Ada's generic failure text.

### Step 7: re-measure (operator action)

Re-run the Step 1 queries and compare. Targets:

| Metric | Before | Target |
|---|---|---|
| Median `llm_calls` per run | 8 | 2-3 |
| Median `prompt_tokens` per run | ~55,000 | under ~17,000 |
| Runs stopped on `deadline` | tbd | near zero |

---

## 4. Measured outcome

`npm run ada:tokens:diff` against the committed baseline, before saving the new one:

| | Before | After | Delta |
|---|---|---|---|
| Per call | 5,747 | 4,850 | -15.6% |
| **Per run** | **54,685** | **16,828** | **-69.2%** |
| Repeated prefix | 45,976 | 14,550 | -68.4% |
| Tool share of run | 59% | 54% | |

Two honest caveats on that number. Part of the per-call drop (-1,000 tool tokens) came from the action-dispatch collapse already committed in `d86e1ce`, not from this change. And the static system rules grew **+110 tokens** here — the cost of the turn-pressure guidance, which buys a request reduction worth far more than 110 tokens.

The run figure is where this change lands: 8 round trips became 3 for the same eight tool calls. Combined with Step 3's second quota bucket, the same free keys should serve roughly 5x the messages per minute.

If that is still not enough headroom, the remaining free-tier options are more Google accounts in the pool, or leaning harder on the already-implemented Cerebras fallback. The paid options, deliberately out of scope here, would be enabling billing on one key (Tier 1 lifts Flash to roughly 1,000 RPM) or routing through a gateway the way `aqademiq-app` does.

---

## 4a. What to set in the Edge secrets

Every default in code is safe without these; each one is an opt-in improvement or a check.

```
GEMINI_MODELS=gemini-2.5-flash-lite,gemini-flash-latest   # two quota buckets per key
ADA_THINKING_BUDGET=0        # only after confirming the pinned model accepts 0
ADA_DAILY_CALL_CAP=200       # per user per UTC day; 0 disables
# and confirm:
ADA_NUDGES_ENABLED           # must be UNSET (Step 0)
UPSTASH_REDIS_REST_URL       # must be SET, or key cooldowns are per-isolate
```

---

## 5. Caveat on the numbers

Free-tier RPM/RPD values move, and Google applies them per project and per model rather than publishing one universal figure. The 15 RPM / 1,500 RPD figures used above are the commonly documented Flash values as of August 2026. Confirm the live limits for each account in the AI Studio rate-limit view for the project behind that key before sizing anything precisely.
