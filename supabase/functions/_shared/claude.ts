// §4.3 AI provider client for edge. Port of src/infra/claude.service.ts, with:
//   - `rotating`  → round-robin pool of Gemini + Cerebras free-tier keys
//                   (_shared/ai.ts), the preferred path when key pools are set
//   - `anthropic` → direct Anthropic Messages API (fetch)
//   - `vertex`    → Claude on Vertex AI via _shared/vertex.ts
// All return the Anthropic Messages shape so Ada's tool loop is provider-agnostic.
import { env } from './env.ts';
import { isVertexConfigured, vertexMessages, vertexMessagesStream } from './vertex.ts';
import { rotatingChat, rotationConfigured } from './ai.ts';

export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown>; }
export interface CreateMessageParams {
  system: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
  tools?: ToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  model?: string;
  maxTokens?: number;
}
export interface BreakdownStep { title: string; duration_seconds: number; }

type Provider = 'rotating' | 'anthropic' | 'vertex' | 'none';

function resolveProvider(): Provider {
  const explicit = env('AI_PROVIDER')?.trim();
  if (explicit) {
    if (explicit === 'anthropic' || explicit === 'vertex') return explicit;
    if (explicit === 'gemini' || explicit === 'cerebras' || explicit === 'rotating') {
      if (rotationConfigured()) return 'rotating';
      console.warn(`AI_PROVIDER="${explicit}" but no GEMINI_API_KEYS/CEREBRAS_API_KEYS set; AI will use fallbacks.`);
      return 'none';
    }
    console.warn(`AI_PROVIDER="${explicit}" is unsupported; AI features will use fallbacks.`);
    return 'none';
  }
  if (rotationConfigured()) return 'rotating';
  if (env('ANTHROPIC_API_KEY')) return 'anthropic';
  if (isVertexConfigured()) return 'vertex';
  return 'none';
}

const provider: Provider = resolveProvider();

function opus(): string {
  return env('CLAUDE_OPUS_MODEL') ?? 'claude-opus-4-8';
}
function haiku(): string {
  return env('CLAUDE_HAIKU_MODEL') ?? 'claude-haiku-4-5';
}

// deno-lint-ignore no-explicit-any
async function call(model: string, body: Record<string, any>, stream = false): Promise<any> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, ...body, ...(stream ? { stream: true } : {}) }),
    });
    if (!res.ok) throw new Error(`Anthropic messages failed (${res.status}): ${await res.text()}`);
    return stream ? res : res.json();
  }
  if (provider === 'vertex') {
    // deno-lint-ignore no-explicit-any
    const params = { model, max_tokens: body.max_tokens ?? 2048, ...body } as any;
    return stream ? vertexMessagesStream(params) : vertexMessages(params);
  }
  throw new Error('No AI provider configured (set ANTHROPIC_API_KEY or Vertex GCP_* secrets)');
}

export const claude = {
  provider,
  get opus() { return opus(); },
  get haiku() { return haiku(); },
  isConfigured(): boolean { return provider !== 'none'; },

  /** One smart-model turn. Caller owns the tool-execution loop. Returns Anthropic shape. */
  // deno-lint-ignore no-explicit-any
  async createMessage(params: CreateMessageParams): Promise<any> {
    if (provider === 'rotating') {
      return rotatingChat({
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        toolChoice: params.toolChoice,
        maxTokens: params.maxTokens ?? 2048,
      });
    }
    return call(params.model ?? opus(), {
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools } : {}),
      ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
    });
  },

  /** Streaming turn (SSE Response passthrough). */
  async createMessageStream(params: CreateMessageParams): Promise<Response> {
    return call(params.model ?? opus(), {
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools } : {}),
      ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
    }, true) as Promise<Response>;
  },

  /** §2.2 task breakdown via fast model + forced tool call. Throws on failure so the caller can fall back. */
  async breakdownSteps(title: string, totalSeconds: number, maxSteps = 4): Promise<BreakdownStep[]> {
    const tool: ToolDef = {
      name: 'emit_breakdown',
      description: 'Return 2–4 concrete, ordered microsteps that complete the task.',
      input_schema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array', minItems: 2, maxItems: maxSteps,
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, duration_seconds: { type: 'integer', minimum: 0 } },
              required: ['title', 'duration_seconds'],
            },
          },
        },
        required: ['steps'],
      },
    };
    const messages = [{
      role: 'user',
      content:
        `Break this study task into ${maxSteps} or fewer concrete microsteps. ` +
        `Total time is about ${Math.round(totalSeconds / 60)} minutes; split duration_seconds across the steps.\n\n` +
        `Task: ${title}`,
    }];
    const res = provider === 'rotating'
      ? await rotatingChat({
        system: 'You break study tasks into concrete microsteps.',
        messages,
        tools: [tool],
        toolChoice: { type: 'tool', name: 'emit_breakdown' },
        maxTokens: 1024,
      })
      : await call(haiku(), {
        max_tokens: 1024,
        system: 'You break study tasks into concrete microsteps.',
        messages,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'emit_breakdown' },
      });
    // deno-lint-ignore no-explicit-any
    const block = (res.content as any[]).find((b) => b.type === 'tool_use');
    const steps = block?.input?.steps;
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('no steps returned');
    // deno-lint-ignore no-explicit-any
    return steps.map((s: any) => ({
      title: String(s.title),
      duration_seconds: Number.isInteger(s.duration_seconds) ? s.duration_seconds : 0,
    }));
  },
};
