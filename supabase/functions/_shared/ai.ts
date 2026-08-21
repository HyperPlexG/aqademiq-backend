// Rotating free-tier AI layer — round-robins across a pool of Gemini + Cerebras
// API keys, trying Gemini before Cerebras and failing over to the next key when
// one hits its quota (429, or Cerebras' 402 "payment required"), benching that
// key for as long as the provider says it needs — seconds for an ordinary
// per-minute rate limit, until the reset for a real daily quota. Both providers are adapted
// to the Anthropic Messages shape ({ content: [text|tool_use], stop_reason }) so
// Ada's tool-use agent loop and task breakdown work unchanged.
//
// Config (Supabase secrets, comma-separated pools):
//   GEMINI_API_KEYS      = key1,key2,...   (Google AI Studio)
//   CEREBRAS_API_KEYS    = key1,key2,...   (Cerebras, OpenAI-compatible)
//   GEMINI_MODEL         = gemini-flash-latest     (default)
//   CEREBRAS_MODEL       = gpt-oss-120b            (default)
import { env } from './env.ts';
import { cacheGet, cacheSet } from './redis.ts';

export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown>; }

/** A file sent inline with the final user turn. Gemini-only (see AiParams.files). */
export interface AiFile {
  mime_type: string;
  /** base64, no data: prefix. */
  data: string;
}

export interface AiParams {
  system: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
  tools?: ToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  maxTokens?: number;
  /**
   * Inline files appended to the last user turn.
   *
   * Gemini accepts PDFs, images, audio and video natively as inlineData parts;
   * Cerebras' OpenAI-compatible endpoint has no equivalent. Setting this
   * therefore restricts the rotation to Gemini keys rather than silently
   * dropping the attachment on a Cerebras failover — a caller that asked about a
   * file must never get an answer produced without it.
   */
  files?: AiFile[];
}

/**
 * base64 for binary data, chunked because `String.fromCharCode(...bytes)` on a
 * multi-megabyte array overflows the argument limit.
 */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
/** What one call cost. Free-tier quota is spent per call, so this is recorded
 *  even when the run that made the call is later abandoned. */
export interface AiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  /** Which pool entry served it, e.g. "gemini:a1b2c3" — for per-key attribution. */
  key_id: string;
  model: string;
}

// Anthropic-shaped result the callers expect.
export interface AiResult {
  // deno-lint-ignore no-explicit-any
  content: any[];
  stop_reason: 'tool_use' | 'end_turn';
  usage?: AiUsage;
}

type Provider = 'gemini' | 'cerebras' | 'groq';
interface KeyEntry { provider: Provider; key: string; model: string; id: string }

function splitKeys(v?: string): string[] {
  return (v ?? '').split(',').map((k) => k.trim()).filter(Boolean);
}

/**
 * Every key paired with every model it may serve.
 *
 * Free-tier RPM and RPD are metered per project PER MODEL, so the same key asked
 * for two different models draws on two independent quotas. Naming a second
 * model in GEMINI_MODELS is therefore a straight capacity increase on
 * credentials we already have — and because `id` carries the model, benching a
 * key for one model leaves it usable for the other.
 *
 * Unset GEMINI_MODELS keeps exactly one entry per key, which is the previous
 * behaviour.
 */
function pool(): KeyEntry[] {
  const out: KeyEntry[] = [];
  for (const key of splitKeys(env('GEMINI_API_KEYS'))) {
    for (const model of geminiModels()) {
      out.push({ provider: 'gemini', key, model, id: `gemini:${key.slice(-6)}:${model}` });
    }
  }
  for (const key of splitKeys(env('GROQ_API_KEYS'))) {
    for (const model of groqModels()) {
      out.push({ provider: 'groq', key, model, id: `groq:${key.slice(-6)}:${model}` });
    }
  }
  for (const key of splitKeys(env('CEREBRAS_API_KEYS'))) {
    for (const model of cerebrasModels()) {
      out.push({ provider: 'cerebras', key, model, id: `cerebras:${key.slice(-6)}:${model}` });
    }
  }
  return out;
}

export function rotationConfigured(): boolean {
  return pool().length > 0;
}

// `gemini-2.5-flash` is closed to new API keys — every key 404s with "no longer
// available to new users" — so the default is the floating `-latest` alias, which
// Google's own quickstart hands out and which keeps working as models roll over.
// Pin a dated model id via the GEMINI_MODEL secret if reproducibility ever matters
// more than availability (the alias can change behaviour under you).
const geminiModel = () => env('GEMINI_MODEL') ?? 'gemini-flash-latest';
const cerebrasModel = () => env('CEREBRAS_MODEL') ?? 'gpt-oss-120b';
/**
 * Chosen against the live account's real limits, not the docs.
 *
 * Groq does not serve the llama-3.3-70b id most guides reach for. Of what it
 * does serve, `groq/compound` looks far better on paper — 70K TPM and no daily
 * token cap, against 8K TPM here — but it answers
 * "`tool calling` is not supported with this model", which rules it out
 * completely: every Ada turn is a forced tool call. Of the tool-capable models
 * (all 30 RPM / 1K RPD / 8K TPM / 200K TPD) gpt-oss-120b is the strongest, and
 * it was verified end to end returning a well-formed forced tool call.
 *
 * The 8K TPM is the number to watch. An Ada call is ~4.9K tokens of prompt plus
 * the growing transcript, so ONE call fits comfortably but a second within the
 * same minute on the same key will not — which is exactly why the pool rotates
 * per key. Ten independent keys make that a non-issue today (verified: each key
 * reports its own untouched 1K RPD, so these are separate accounts, not one org
 * quota split ten ways).
 *
 * Listing a second id in GROQ_MODELS would double the buckets again, but the
 * rotation treats every key x model entry as a peer rather than a fallback, so
 * half of Ada's turns would land on the weaker 20b. At ~116 messages/day of
 * headroom from 120b alone that trade is not worth making yet.
 */
const groqModel = () => env('GROQ_MODEL') ?? 'openai/gpt-oss-120b';

/**
 * The models a provider's keys may serve, widest-quota-first is up to the
 * operator's ordering. The plural secret wins when set; the singular one remains
 * the default so an existing deployment behaves identically until it opts in.
 */
function modelsFor(listVar: string, single: () => string): string[] {
  const list = splitKeys(env(listVar));
  return list.length ? list : [single()];
}
const geminiModels = () => modelsFor('GEMINI_MODELS', geminiModel);
const cerebrasModels = () => modelsFor('CEREBRAS_MODELS', cerebrasModel);
const groqModels = () => modelsFor('GROQ_MODELS', groqModel);

/**
 * Ceiling on Gemini's internal reasoning tokens, from ADA_THINKING_BUDGET.
 *
 * Thinking is billed as output and, more importantly, is slow: a thinking turn
 * can take long enough to trip the agent's wall-clock deadline, which throws
 * away every call the run has already paid for. Setting this to 0 turns it off.
 *
 * Unset sends no thinkingConfig at all, which is the provider default and the
 * previous behaviour — deliberate, because not every Gemini model accepts a
 * budget of 0 and a rejected generationConfig fails the whole request.
 */
function thinkingBudget(): number | undefined {
  const raw = env('ADA_THINKING_BUDGET');
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

// ---- cooldown tracking (per key) ----
//
// Benching a key is how the pool routes around a quota, but for how long is the
// whole question. These providers return 429 for two very different things:
//
//   a per-MINUTE rate limit  — the key is fine and usable again in seconds
//   a per-DAY quota          — the key really is done until it resets
//
// Treating both as "exhausted until UTC midnight", as this used to, means a
// single burst of traffic permanently sidelines a healthy key. Do that five
// times and the whole pool is empty while every key still works — which is
// exactly what happened: five Gemini keys benched, every run failing with
// "All AI keys failed", and intermittent recovery only because the code falls
// back to trying benched keys when nothing is left.
//
// So the cooldown is now derived from what the provider actually said.

/** Fallback when a 429 carries no usable retry hint. */
const DEFAULT_RATE_LIMIT_COOLDOWN_S = 60;
/** Nothing is benched longer than this except a genuine daily quota. */
const MAX_RATE_LIMIT_COOLDOWN_S = 300;

/** id → epoch ms when the bench expires. Mirrors the Redis TTL for isolates
 *  that have no Upstash configured, or when a lookup fails. */
const memCooldown = new Map<string, number>();

function secondsToUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

async function isExhausted(id: string): Promise<boolean> {
  const until = memCooldown.get(id);
  if (until !== undefined) {
    // Expiry is checked rather than assumed: the old Set had no notion of time,
    // so an entry added for a 30-second limit stayed for the isolate's life.
    if (Date.now() < until) return true;
    memCooldown.delete(id);
  }
  return (await cacheGet(`ai:cool:${id}`)) !== null;
}

async function markExhausted(id: string, seconds: number): Promise<void> {
  const ttl = Math.max(5, Math.ceil(seconds));
  memCooldown.set(id, Date.now() + ttl * 1000);
  await cacheSet(`ai:cool:${id}`, '1', ttl);
}

// Rotate by a random start so load spreads across stateless invocations
// (Upstash isn't required); quota-failover guarantees correctness regardless.
function rotate<T>(arr: T[]): T[] {
  if (arr.length <= 1) return arr;
  const start = Math.floor(Math.random() * arr.length);
  return [...arr.slice(start), ...arr.slice(0, start)];
}

// Providers are tried in this order. Gemini first: its free tier is a daily
// request quota that resets, whereas Cerebras returns a hard 402 once the
// account needs billing — so Cerebras is the fallback, not the coin-flip peer a
// flat random rotation made it.
//
// Groq sits BETWEEN them, and deliberately so: its free tier rate-limits and
// then resets like Gemini's, whereas the Cerebras keys have been answering 402
// (out of credit) — a provider that is dead until someone pays is the worst
// fallback, not the first one. So when Gemini is exhausted the next request goes
// to Groq, which is the behaviour this pool is for.
const PROVIDER_PRIORITY: readonly Provider[] = ['gemini', 'groq', 'cerebras'];

/// Every key in provider-priority order, rotated *within* each provider so load
/// still spreads across that provider's own keys.
function orderedCandidates(): KeyEntry[] {
  const all = pool();
  const out: KeyEntry[] = [];
  for (const provider of PROVIDER_PRIORITY) {
    out.push(...rotate(all.filter((k) => k.provider === provider)));
  }
  return out;
}

/**
 * A key is temporarily unusable. `cooldownSeconds` says for how long, taken from
 * what the provider reported rather than assumed — see the cooldown block above.
 */
class QuotaError extends Error {
  constructor(message: string, readonly cooldownSeconds: number) {
    super(message);
  }
}

/**
 * How long to bench a Gemini key after a 429.
 *
 * Google returns RetryInfo with an exact delay for rate limits, and names the
 * violated quota in QuotaFailure. Per-minute limits are the common case for
 * bursty traffic and must not be treated as the day being over.
 */
export function geminiCooldownSeconds(body: string): number {
  const retry = /"retryDelay"\s*:\s*"(\d+)(?:\.\d+)?s"/.exec(body);
  if (retry) {
    // +1s of slack: retrying on the exact boundary tends to 429 again.
    return Math.min(MAX_RATE_LIMIT_COOLDOWN_S, Math.max(5, Number(retry[1]) + 1));
  }
  // Only a genuinely daily quota justifies benching until it resets.
  if (/PerDay|per day|daily limit/i.test(body)) return secondsToUtcMidnight();
  return DEFAULT_RATE_LIMIT_COOLDOWN_S;
}

/**
 * How long to bench an OpenAI-compatible key after a 429.
 *
 * Prefers the provider's own `Retry-After` (Groq sends one, in seconds) over a
 * guess, for the same reason the Gemini path prefers `retryDelay`: benching a
 * key for a flat minute when it says four seconds throws away most of a working
 * quota, and benching for four seconds when the limit is daily hammers it all
 * day. Falls back to scanning the body for a daily limit, then to the default.
 */
export function openAiCooldownSeconds(retryAfter: string | null, body: string): number {
  if (retryAfter) {
    const secs = Number(retryAfter.trim());
    if (Number.isFinite(secs) && secs >= 0) {
      // +1s of slack: retrying on the exact boundary tends to 429 again.
      return Math.min(MAX_RATE_LIMIT_COOLDOWN_S, Math.max(5, Math.ceil(secs) + 1));
    }
  }
  // Groq words a daily exhaustion as "rate limit reached ... per day".
  if (/per day|daily limit|per-day|requests per day/i.test(body)) return secondsToUtcMidnight();
  return DEFAULT_RATE_LIMIT_COOLDOWN_S;
}

/**
 * Gemini rejects an OBJECT-typed `parameters` whose `properties` map is empty
 * ("should be non-empty for OBJECT type"), which 400s the whole request — so a
 * parameterless tool such as `list_subjects` must omit `parameters` entirely
 * rather than send `{ type: 'object', properties: {} }`. Cerebras/OpenAI accepts
 * the empty form, so this shaping is Gemini-only.
 */
function geminiFunctionDeclaration(t: ToolDef) {
  const props = (t.input_schema as { properties?: Record<string, unknown> } | undefined)?.properties;
  const base = { name: t.name, description: t.description };
  return props && Object.keys(props).length > 0
    ? { ...base, parameters: t.input_schema }
    : base;
}

/** One chat turn across the rotating pool. Throws if no key succeeds. */
export async function rotatingChat(params: AiParams): Promise<AiResult> {
  // A call carrying files can only be served by Gemini, so narrow the pool
  // rather than letting a Cerebras failover answer without seeing the file.
  const candidates = params.files?.length
    ? orderedCandidates().filter((k) => k.provider === 'gemini')
    : orderedCandidates();
  if (candidates.length === 0) {
    throw new Error(
      params.files?.length
        ? 'Reading files needs a Gemini key (GEMINI_API_KEYS); Cerebras cannot accept attachments.'
        : 'No AI keys configured (GEMINI_API_KEYS / CEREBRAS_API_KEYS)',
    );
  }

  const fresh: KeyEntry[] = [];
  for (const c of candidates) { if (!(await isExhausted(c.id))) fresh.push(c); }
  // If everything is marked exhausted, still try them (limits may have reset).
  const order = fresh.length ? fresh : candidates;

  // Collect every failure, not just the last one: reporting only `lastErr` meant
  // a working-but-broken Gemini key was masked by whatever the final key said.
  const errors: string[] = [];
  for (const c of order) {
    try {
      const res = c.provider === 'gemini'
        ? await geminiChat(c.key, c.model, params)
        : c.provider === 'groq'
        ? await groqChat(c.key, c.model, params)
        : await cerebrasChat(c.key, c.model, params);
      // Stamped here rather than inside each adapter so the key id (which only
      // the pool knows) travels with the cost.
      if (res.usage) {
        res.usage.key_id = c.id;
        res.usage.model = c.model;
      }
      return res;
    } catch (e) {
      errors.push(`${c.id} → ${e instanceof Error ? e.message : String(e)}`);
      if (e instanceof QuotaError) {
        await markExhausted(c.id, e.cooldownSeconds);
        // Logged so a pool that keeps emptying can be diagnosed from the length
        // of the cooldowns, which distinguishes "bursty traffic" from "the free
        // tier is genuinely used up for today".
        console.warn(`[ai] benched ${c.id} for ${Math.ceil(e.cooldownSeconds)}s`);
      }
      // Any failure (quota, network, 5xx) falls through to the next key.
    }
  }
  throw new Error(`All AI keys failed: ${errors.join(' | ')}`);
}

// ================= Cerebras (OpenAI-compatible) =================
/**
 * One adapter for every OpenAI-compatible chat-completions provider.
 *
 * Cerebras and Groq speak byte-identical APIs, so this was generalised rather
 * than copied: the tool-call mapping below is the fiddly part, and two copies of
 * it would drift the moment one is fixed.
 */
async function openAiCompatChat(
  endpoint: string,
  label: string,
  key: string,
  model: string,
  p: AiParams,
): Promise<AiResult> {
  // deno-lint-ignore no-explicit-any
  const msgs: any[] = [{ role: 'system', content: p.system }];
  for (const m of p.messages) {
    if (typeof m.content === 'string') { msgs.push({ role: m.role, content: m.content }); continue; }
    // deno-lint-ignore no-explicit-any
    const blocks = m.content as any[];
    if (m.role === 'assistant') {
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const toolCalls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
      msgs.push({ role: 'assistant', content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    } else {
      for (const b of blocks) {
        if (b.type === 'tool_result') msgs.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
      }
    }
  }
  // deno-lint-ignore no-explicit-any
  const body: any = { model, messages: msgs, max_tokens: p.maxTokens ?? 2048 };
  if (p.tools?.length) {
    body.tools = p.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    body.tool_choice = p.toolChoice ? { type: 'function', function: { name: p.toolChoice.name } } : 'auto';
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 402 = "Payment required … visit your billing tab": the account is out of
  // credit, so this key is dead for the rest of the day exactly like a 429. It
  // is treated as a QuotaError so the key gets benched instead of being retried
  // (and burning a round-trip) on every single request.
  if (res.status === 429 || res.status === 402) {
    const body = await res.text();
    // 402 is an account out of credit — that does not fix itself in a minute, so
    // it is benched until the day rolls over. A 429 is an ordinary rate limit,
    // and Groq says how long to wait in a Retry-After header, so ask rather than
    // guess (Cerebras sends none and falls back to the default).
    const cooldown = res.status === 402
      ? secondsToUtcMidnight()
      : openAiCooldownSeconds(res.headers.get('retry-after'), body);
    throw new QuotaError(`${label} ${res.status}: ${body.slice(0, 200)}`, cooldown);
  }
  if (!res.ok) throw new Error(`${label} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const msg = json.choices?.[0]?.message ?? {};
  // deno-lint-ignore no-explicit-any
  const content: any[] = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  for (const tc of msg.tool_calls ?? []) {
    let input: unknown = {};
    try { input = JSON.parse(tc.function?.arguments ?? '{}'); } catch { input = {}; }
    content.push({ type: 'tool_use', id: tc.id, name: tc.function?.name, input });
  }
  const stop_reason = (json.choices?.[0]?.finish_reason === 'tool_calls' || content.some((b) => b.type === 'tool_use')) ? 'tool_use' : 'end_turn';
  return {
    content,
    stop_reason,
    usage: {
      prompt_tokens: Number(json.usage?.prompt_tokens ?? 0),
      completion_tokens: Number(json.usage?.completion_tokens ?? 0),
      key_id: '',
      model,
    },
  };
}

// ================= Gemini (generateContent) =================
const cerebrasChat = (key: string, model: string, p: AiParams) =>
  openAiCompatChat('https://api.cerebras.ai/v1/chat/completions', 'cerebras', key, model, p);

const groqChat = (key: string, model: string, p: AiParams) =>
  openAiCompatChat('https://api.groq.com/openai/v1/chat/completions', 'groq', key, model, p);

async function geminiChat(key: string, model: string, p: AiParams): Promise<AiResult> {
  // Map Anthropic tool_use ids → names so tool_results become functionResponses.
  const idToName = new Map<string, string>();
  for (const m of p.messages) {
    if (m.role === 'assistant' && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === 'tool_use') idToName.set(b.id, b.name);
    }
  }
  // deno-lint-ignore no-explicit-any
  const contents: any[] = [];
  for (const m of p.messages) {
    if (typeof m.content === 'string') {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const blocks = m.content as any[];
    if (m.role === 'assistant') {
      // deno-lint-ignore no-explicit-any
      const parts: any[] = [];
      for (const b of blocks) {
        // Gemini rejects a continuation whose functionCall parts have lost their
        // `thoughtSignature` ("Function call is missing a thought_signature…",
        // 400 INVALID_ARGUMENT). We drive the tool loop ourselves and resend the
        // whole history each turn — stateless mode — so every thought block and
        // signature has to go back exactly as it arrived.
        if (b.type === 'gemini_thought') {
          if (!b.text && !b.thoughtSignature) continue;
          parts.push({
            text: b.text ?? '',
            thought: true,
            ...(b.thoughtSignature ? { thoughtSignature: b.thoughtSignature } : {}),
          });
        } else if (b.type === 'text') {
          parts.push({ text: b.text });
        } else if (b.type === 'tool_use') {
          parts.push({
            functionCall: { name: b.name, args: b.input ?? {} },
            ...(b.thoughtSignature ? { thoughtSignature: b.thoughtSignature } : {}),
          });
        }
      }
      contents.push({ role: 'model', parts });
    } else {
      // deno-lint-ignore no-explicit-any
      const parts: any[] = [];
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          let parsed: unknown;
          try { parsed = typeof b.content === 'string' ? JSON.parse(b.content) : b.content; } catch { parsed = { result: b.content }; }
          parts.push({ functionResponse: { name: idToName.get(b.tool_use_id) ?? 'tool', response: { result: parsed } } });
        }
      }
      contents.push({ role: 'user', parts });
    }
  }
  // Attachments ride on the final user turn, which is the one the question was
  // asked in. Appending rather than replacing keeps the prompt text alongside
  // the file, so the model knows what it is being asked to do with it.
  if (p.files?.length) {
    const last = contents[contents.length - 1];
    const fileParts = p.files.map((f) => ({ inlineData: { mimeType: f.mime_type, data: f.data } }));
    if (last && last.role === 'user') {
      last.parts.push(...fileParts);
    } else {
      contents.push({ role: 'user', parts: fileParts });
    }
  }

  const budget = thinkingBudget();
  // deno-lint-ignore no-explicit-any
  const body: any = {
    systemInstruction: { parts: [{ text: p.system }] },
    contents,
    generationConfig: {
      maxOutputTokens: p.maxTokens ?? 2048,
      ...(budget === undefined ? {} : { thinkingConfig: { thinkingBudget: budget } }),
    },
  };
  if (p.tools?.length) {
    body.tools = [{ functionDeclarations: p.tools.map(geminiFunctionDeclaration) }];
    body.toolConfig = { functionCallingConfig: p.toolChoice ? { mode: 'ANY', allowedFunctionNames: [p.toolChoice.name] } : { mode: 'AUTO' } };
  }
  // The key goes in the `x-goog-api-key` header rather than a `?key=` query
  // param (both are supported) so it can't leak into URL logging along the way.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    // The body is read rather than discarded: it is the only thing that says
    // whether this key is unusable for 30 seconds or for the rest of the day.
    const body = await res.text();
    throw new QuotaError(`gemini 429: ${body.slice(0, 300)}`, geminiCooldownSeconds(body));
  }
  if (res.status === 403) {
    const t = await res.text();
    if (/quota|RESOURCE_EXHAUSTED/i.test(t)) throw new QuotaError('gemini quota', geminiCooldownSeconds(t));
    throw new Error(`gemini 403: ${t}`);
  }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // deno-lint-ignore no-explicit-any
  const content: any[] = [];
  for (const part of parts) {
    // Thinking models emit their reasoning as `thought` parts. These must never
    // reach the user, but they carry signatures Gemini needs replayed verbatim,
    // so they are kept as an opaque block instead of being dropped. Every other
    // layer ignores an unknown block type, so this rides along harmlessly.
    if (part.thought) {
      content.push({ type: 'gemini_thought', text: part.text ?? '', thoughtSignature: part.thoughtSignature });
      continue;
    }
    if (part.text) content.push({ type: 'text', text: part.text });
    else if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: `call_${crypto.randomUUID().slice(0, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
        // Kept so the next turn can hand it straight back — see the assistant
        // branch above. Undefined on non-thinking models, which is fine.
        thoughtSignature: part.thoughtSignature,
      });
    }
  }
  const stop_reason = content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
  // Thinking models bill their reasoning as output too, so thoughtsTokenCount is
  // folded into completion — otherwise the recorded spend understates the real
  // quota burn on exactly the turns that cost the most.
  const um = json.usageMetadata ?? {};
  return {
    content,
    stop_reason,
    usage: {
      prompt_tokens: Number(um.promptTokenCount ?? 0),
      completion_tokens: Number(um.candidatesTokenCount ?? 0) + Number(um.thoughtsTokenCount ?? 0),
      key_id: '',
      model,
    },
  };
}
