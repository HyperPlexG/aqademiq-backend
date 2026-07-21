// Rotating free-tier AI layer — round-robins across a pool of Gemini + Cerebras
// API keys, trying Gemini before Cerebras and failing over to the next key when
// one hits its quota (429, or Cerebras' 402 "payment required"),
// and marking that key exhausted until UTC midnight. Both providers are adapted
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
export interface AiParams {
  system: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
  tools?: ToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  maxTokens?: number;
}
// Anthropic-shaped result the callers expect.
export interface AiResult {
  // deno-lint-ignore no-explicit-any
  content: any[];
  stop_reason: 'tool_use' | 'end_turn';
}

type Provider = 'gemini' | 'cerebras';
interface KeyEntry { provider: Provider; key: string; id: string }

function splitKeys(v?: string): string[] {
  return (v ?? '').split(',').map((k) => k.trim()).filter(Boolean);
}

function pool(): KeyEntry[] {
  const out: KeyEntry[] = [];
  for (const key of splitKeys(env('GEMINI_API_KEYS'))) out.push({ provider: 'gemini', key, id: `gemini:${key.slice(-6)}` });
  for (const key of splitKeys(env('CEREBRAS_API_KEYS'))) out.push({ provider: 'cerebras', key, id: `cerebras:${key.slice(-6)}` });
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

// ---- exhaustion tracking (per-key, resets at UTC midnight) ----
const memExhausted = new Set<string>();
function utcDay(): string { return new Date().toISOString().slice(0, 10); }
function secondsToUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.max(60, Math.ceil((next.getTime() - now.getTime()) / 1000));
}
async function isExhausted(id: string): Promise<boolean> {
  if (memExhausted.has(`${id}:${utcDay()}`)) return true;
  return (await cacheGet(`ai:ex:${id}:${utcDay()}`)) !== null;
}
async function markExhausted(id: string): Promise<void> {
  memExhausted.add(`${id}:${utcDay()}`);
  await cacheSet(`ai:ex:${id}:${utcDay()}`, '1', secondsToUtcMidnight());
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
const PROVIDER_PRIORITY: readonly Provider[] = ['gemini', 'cerebras'];

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

class QuotaError extends Error {}

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
  const candidates = orderedCandidates();
  if (candidates.length === 0) throw new Error('No AI keys configured (GEMINI_API_KEYS / CEREBRAS_API_KEYS)');

  const fresh: KeyEntry[] = [];
  for (const c of candidates) { if (!(await isExhausted(c.id))) fresh.push(c); }
  // If everything is marked exhausted, still try them (limits may have reset).
  const order = fresh.length ? fresh : candidates;

  // Collect every failure, not just the last one: reporting only `lastErr` meant
  // a working-but-broken Gemini key was masked by whatever the final key said.
  const errors: string[] = [];
  for (const c of order) {
    try {
      return c.provider === 'gemini'
        ? await geminiChat(c.key, geminiModel(), params)
        : await cerebrasChat(c.key, cerebrasModel(), params);
    } catch (e) {
      errors.push(`${c.id} → ${e instanceof Error ? e.message : String(e)}`);
      if (e instanceof QuotaError) await markExhausted(c.id);
      // Any failure (quota, network, 5xx) falls through to the next key.
    }
  }
  throw new Error(`All AI keys failed: ${errors.join(' | ')}`);
}

// ================= Cerebras (OpenAI-compatible) =================
async function cerebrasChat(key: string, model: string, p: AiParams): Promise<AiResult> {
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
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  // 402 = "Payment required … visit your billing tab": the account is out of
  // credit, so this key is dead for the rest of the day exactly like a 429. It
  // is treated as a QuotaError so the key gets benched instead of being retried
  // (and burning a round-trip) on every single request.
  if (res.status === 429 || res.status === 402) {
    throw new QuotaError(`cerebras ${res.status}: ${await res.text()}`);
  }
  if (!res.ok) throw new Error(`cerebras ${res.status}: ${await res.text()}`);
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
  return { content, stop_reason };
}

// ================= Gemini (generateContent) =================
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
  // deno-lint-ignore no-explicit-any
  const body: any = {
    systemInstruction: { parts: [{ text: p.system }] },
    contents,
    generationConfig: { maxOutputTokens: p.maxTokens ?? 2048 },
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
  if (res.status === 429) throw new QuotaError('gemini 429');
  if (res.status === 403) { const t = await res.text(); if (/quota|RESOURCE_EXHAUSTED/i.test(t)) throw new QuotaError('gemini quota'); throw new Error(`gemini 403: ${t}`); }
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
  return { content, stop_reason };
}
