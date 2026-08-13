// §4.3 AI provider client for edge. Port of src/infra/claude.service.ts, with:
//   - `rotating`  → round-robin pool of Gemini + Cerebras free-tier keys
//                   (_shared/ai.ts), the preferred path when key pools are set
//   - `anthropic` → direct Anthropic Messages API (fetch)
//   - `vertex`    → Claude on Vertex AI via _shared/vertex.ts
// All return the Anthropic Messages shape so Ada's tool loop is provider-agnostic.
import { env } from './env.ts';
import { isVertexConfigured, vertexMessages, vertexMessagesStream } from './vertex.ts';
import { type AiFile, type AiUsage, rotatingChat, rotationConfigured } from './ai.ts';

export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown>; }
export interface CreateMessageParams {
  system: string;
  // deno-lint-ignore no-explicit-any
  messages: any[];
  tools?: ToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  model?: string;
  maxTokens?: number;
  /** Inline files for the final user turn. Requires the `rotating` provider. */
  files?: AiFile[];
}
export interface BreakdownStep { title: string; detail?: string; duration_seconds: number; }

/**
 * What the model needs to break a task down usefully.
 *
 * The old signature took a bare title and a duration, which is why breakdowns
 * read as boilerplate: asked to split "Lab report" with nothing else, there is
 * no honest answer except "plan / work / review". Everything here is already on
 * the task row or one join away.
 */
export interface BreakdownContext {
  title: string;
  totalSeconds: number;
  subject?: string | null;
  taskType?: string | null;
  /** The user's own notes on the task — usually the most specific signal there is. */
  notes?: string | null;
  dueInDays?: number | null;
  priority?: string | null;
}

type Provider = 'rotating' | 'anthropic' | 'vertex' | 'none';

function resolveProvider(): Provider {
  const explicit = env('AI_PROVIDER')?.trim();
  if (explicit) {
    // Never trust an explicit provider without its credential: doing so makes
    // isConfigured() true while every call throws, which surfaces to the user as
    // Ada's generic "couldn't reach my planning brain" instead of a clear config error.
    if (explicit === 'anthropic') {
      if (env('ANTHROPIC_API_KEY')) return 'anthropic';
      console.warn('AI_PROVIDER="anthropic" but ANTHROPIC_API_KEY is not set; AI will use fallbacks.');
      return 'none';
    }
    if (explicit === 'vertex') {
      if (isVertexConfigured()) return 'vertex';
      console.warn('AI_PROVIDER="vertex" but the Vertex GCP_* secrets are incomplete; AI will use fallbacks.');
      return 'none';
    }
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

/**
 * Cost of one call, whichever provider served it.
 *
 * `rotating` reports it in our own shape; Anthropic and Vertex both use the
 * Messages-API `usage: { input_tokens, output_tokens }`. Returns zeros rather
 * than undefined when a provider omits usage, so accumulating a run's spend
 * never has to null-check.
 */
// deno-lint-ignore no-explicit-any
export function usageOf(res: any, fallbackModel: string): AiUsage {
  const rotating = res?.usage as AiUsage | undefined;
  if (rotating && typeof rotating.prompt_tokens === 'number' && 'key_id' in rotating) {
    return rotating;
  }
  const u = res?.usage ?? {};
  return {
    prompt_tokens: Number(u.input_tokens ?? 0),
    completion_tokens: Number(u.output_tokens ?? 0),
    key_id: provider,
    model: res?.model ?? fallbackModel,
  };
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
        files: params.files,
      });
    }
    // Anthropic and Vertex both take documents/images as content blocks rather
    // than a sibling field, which nothing needs yet — fail loudly instead of
    // quietly answering a question about a file without having read it.
    if (params.files?.length) {
      throw new Error(`Reading files is only implemented for the rotating (Gemini) provider, not "${provider}".`);
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
  async breakdownSteps(ctx: BreakdownContext, maxSteps = 6): Promise<BreakdownStep[]> {
    const minutes = Math.max(1, Math.round(ctx.totalSeconds / 60));
    const tool: ToolDef = {
      name: 'emit_breakdown',
      description:
        'Return ordered steps that actually complete THIS task. Each step names ' +
        'the specific thing to produce or do, not a phase of work.',
      input_schema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            minItems: 2,
            maxItems: maxSteps,
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description:
                    'Imperative and specific: "Derive the transfer function for the RLC network", ' +
                    'not "Work on assignment". Never restate the task title.',
                },
                detail: {
                  type: 'string',
                  description: 'One short line on what finishing this step looks like.',
                },
                duration_seconds: { type: 'integer', minimum: 0 },
              },
              required: ['title', 'duration_seconds'],
            },
          },
        },
        required: ['steps'],
      },
    };

    // Only real facts go in. An absent subject or note is left out rather than
    // sent as "unknown", which the model tends to answer around.
    const facts = [
      `Task: ${ctx.title}`,
      ctx.subject ? `Subject: ${ctx.subject}` : null,
      ctx.taskType ? `Type: ${ctx.taskType}` : null,
      ctx.notes ? `The user's own notes: ${ctx.notes}` : null,
      ctx.dueInDays !== null && ctx.dueInDays !== undefined
        ? `Due in ${ctx.dueInDays} day(s)`
        : null,
      ctx.priority ? `Priority: ${ctx.priority}` : null,
      `Total time budgeted: about ${minutes} minutes`,
    ].filter(Boolean).join('\n');

    const messages = [{
      role: 'user',
      content:
        `${facts}\n\n` +
        `Break this into the fewest steps that genuinely move it forward — 2 for ` +
        `something small, up to ${maxSteps} for a large piece of work. Split ` +
        `duration_seconds so the total is about ${minutes} minutes.`,
    }];

    // The system prompt carries the anti-boilerplate rules because they apply to
    // every call, and because "don't restate the title" is the single instruction
    // that most changes the output.
    const system = [
      'You break a student\'s task into steps they can actually start.',
      '',
      'Rules:',
      '- Use the subject and the task type. A lab report, an essay and a problem',
      '  set do not decompose the same way.',
      '- Name the actual work: the section to draft, the derivation to do, the',
      '  dataset to plot. Never "Plan X", "Work on X" or "Review X" — a step that',
      '  would fit any task at all is not a breakdown.',
      '- Never restate the task title as a step.',
      '- If the notes say what the task involves, follow them over your own guess.',
      '- Fewer, meatier steps beat many trivial ones.',
    ].join('\n');

    const res = provider === 'rotating'
      ? await rotatingChat({
        system,
        messages,
        tools: [tool],
        toolChoice: { type: 'tool', name: 'emit_breakdown' },
        maxTokens: 1024,
      })
      : await call(haiku(), {
        max_tokens: 1024,
        system,
        messages,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'emit_breakdown' },
      });
    // deno-lint-ignore no-explicit-any
    const block = (res.content as any[]).find((b) => b.type === 'tool_use');
    const steps = block?.input?.steps;
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('no steps returned');
    // deno-lint-ignore no-explicit-any
    const mapped: BreakdownStep[] = steps.map((s: any) => ({
      title: String(s.title ?? '').trim(),
      detail: typeof s.detail === 'string' && s.detail.trim() ? s.detail.trim() : undefined,
      duration_seconds: Number.isInteger(s.duration_seconds) && s.duration_seconds >= 0
        ? s.duration_seconds
        : 0,
    })).filter((s: BreakdownStep) => s.title.length > 0);

    if (mapped.length === 0) throw new Error('no usable steps returned');
    // A model that ignored the rules and echoed the title back is worse than the
    // caller's fallback, so reject it rather than persisting it.
    if (isBoilerplate(mapped, ctx.title)) throw new Error('breakdown was boilerplate');
    return mapped;
  },
};

/**
 * True when the "breakdown" is just the task title wearing a hat.
 *
 * Small models under a forced tool call reliably produce `Plan X / Work on X /
 * Review X` when they have nothing specific to say. Persisting that trains users
 * to ignore the feature, so it is treated as a failed call.
 */
export function isBoilerplate(steps: BreakdownStep[], title: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = normalise(title);
  const generic = /^(plan|prepare|start|begin|work on|do|continue|finish|complete|review|check|revise|wrap up)\b/;

  let emptyish = 0;
  for (const step of steps) {
    const s = normalise(step.title);
    // "Work on <title>" / "Review <title>" — the phrase adds nothing to the title.
    const stripped = s.replace(generic, '').trim();
    if (s === t || stripped === t || stripped.length === 0) emptyish++;
    else if (generic.test(s) && stripped.length < 12) emptyish++;
  }
  // Tolerates one weak step in an otherwise real plan; rejects a set that is
  // mostly filler.
  return emptyish >= Math.ceil(steps.length / 2);
}
