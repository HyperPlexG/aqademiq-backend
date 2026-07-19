// Rotating free-tier AI layer — round-robins across a pool of Gemini + Cerebras
// API keys, failing over to the next key when one hits its daily quota (429),
// and marking that key exhausted until UTC midnight. Both providers are adapted
// to the Anthropic Messages shape ({ content: [text|tool_use], stop_reason }) so
// Ada's tool-use agent loop and task breakdown work unchanged.
//
// Config (Supabase secrets, comma-separated pools):
//   GEMINI_API_KEYS      = key1,key2,...   (Google AI Studio)
//   CEREBRAS_API_KEYS    = key1,key2,...   (Cerebras, OpenAI-compatible)
//   GEMINI_MODEL         = gemini-2.5-flash        (default)
//   CEREBRAS_MODEL       = llama-3.3-70b           (default)
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

const geminiModel = () => env('GEMINI_MODEL') ?? 'gemini-2.5-flash';
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

// Rotate the pool by a random start so load spreads across stateless invocations
// (Upstash isn't required); 429-failover guarantees correctness regardless.
function rotate<T>(arr: T[]): T[] {
  if (arr.length <= 1) return arr;
  const start = Math.floor(Math.random() * arr.length);
  return [...arr.slice(start), ...arr.slice(0, start)];
}

class QuotaError extends Error {}

/** One chat turn across the rotating pool. Throws if no key succeeds. */
export async function rotatingChat(params: AiParams): Promise<AiResult> {
  const candidates = rotate(pool());
  if (candidates.length === 0) throw new Error('No AI keys configured (GEMINI_API_KEYS / CEREBRAS_API_KEYS)');

  let lastErr: unknown;
  const fresh: KeyEntry[] = [];
  for (const c of candidates) { if (!(await isExhausted(c.id))) fresh.push(c); }
  // If everything is marked exhausted, still try them (limits may have reset).
  const order = fresh.length ? fresh : candidates;

  for (const c of order) {
    try {
      return c.provider === 'gemini'
        ? await geminiChat(c.key, geminiModel(), params)
        : await cerebrasChat(c.key, cerebrasModel(), params);
    } catch (e) {
      if (e instanceof QuotaError) { await markExhausted(c.id); lastErr = e; continue; }
      lastErr = e; // network/5xx — try the next key too
    }
  }
  throw lastErr ?? new Error('All AI keys failed');
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
  if (res.status === 429) throw new QuotaError('cerebras 429');
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
        if (b.type === 'text') parts.push({ text: b.text });
        else if (b.type === 'tool_use') parts.push({ functionCall: { name: b.name, args: b.input ?? {} } });
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
    body.tools = [{ functionDeclarations: p.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }];
    body.toolConfig = { functionCallingConfig: p.toolChoice ? { mode: 'ANY', allowedFunctionNames: [p.toolChoice.name] } : { mode: 'AUTO' } };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 429) throw new QuotaError('gemini 429');
  if (res.status === 403) { const t = await res.text(); if (/quota|RESOURCE_EXHAUSTED/i.test(t)) throw new QuotaError('gemini quota'); throw new Error(`gemini 403: ${t}`); }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  // deno-lint-ignore no-explicit-any
  const content: any[] = [];
  for (const part of parts) {
    if (part.text) content.push({ type: 'text', text: part.text });
    else if (part.functionCall) content.push({ type: 'tool_use', id: `call_${crypto.randomUUID().slice(0, 8)}`, name: part.functionCall.name, input: part.functionCall.args ?? {} });
  }
  const stop_reason = content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn';
  return { content, stop_reason };
}
