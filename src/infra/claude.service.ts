import { Injectable } from '@nestjs/common';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { geminiStudioCreateMessage, geminiVertexCreateMessage } from './ai/gemini-adapter';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CreateMessageParams {
  system: string;
  messages: any[];
  tools?: ToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  model?: string;
  maxTokens?: number;
}

export interface BreakdownStep {
  title: string;
  duration_seconds: number;
}

type Provider = 'anthropic' | 'vertex' | 'gemini_vertex' | 'gemini_studio' | 'none';

const VALID_PROVIDERS: Provider[] = ['anthropic', 'vertex', 'gemini_vertex', 'gemini_studio', 'none'];

function resolveProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.trim();
  if (explicit) {
    if (!VALID_PROVIDERS.includes(explicit as Provider)) {
      throw new Error(`Invalid AI_PROVIDER="${explicit}"`);
    }
    return explicit as Provider;
  }
  if (process.env.GOOGLE_AI_API_KEY) return 'gemini_studio';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GCP_PROJECT_ID) return 'vertex';
  return 'none';
}

function isGeminiProvider(provider: Provider): boolean {
  return provider === 'gemini_vertex' || provider === 'gemini_studio';
}

/**
 * §4.3 AI provider client. Provider-switchable:
 *  - `anthropic`     → direct Anthropic API
 *  - `vertex`        → Claude on Vertex AI Model Garden
 *  - `gemini_vertex` → Gemini on Vertex AI (ADC / Cloud Run SA)
 *  - `gemini_studio` → Gemini via Google AI Studio API key
 *
 * Auto-detected when AI_PROVIDER is unset: GOOGLE_AI_API_KEY → gemini_studio,
 * ANTHROPIC_API_KEY → anthropic, GCP_PROJECT_ID → vertex (Claude), else none.
 * Set AI_PROVIDER=gemini_vertex explicitly to cut over from Claude on GCP.
 *
 * Universal safety gate (§4.3): no raw LLM output mutates data — Ada proposes,
 * the user confirms, the server validates every field before INSERT.
 */
@Injectable()
export class ClaudeService {
  readonly provider: Provider;
  private _client: any;

  constructor() {
    this.provider = resolveProvider();
  }

  /** Smart model: Claude Opus or GEMINI_MODEL depending on provider. */
  get opus(): string {
    if (isGeminiProvider(this.provider)) {
      return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    }
    return process.env.CLAUDE_OPUS_MODEL ?? 'claude-opus-4-8';
  }

  /** Fast model: Claude Haiku or GEMINI_MODEL_FAST depending on provider. */
  get haiku(): string {
    if (isGeminiProvider(this.provider)) {
      return process.env.GEMINI_MODEL_FAST ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    }
    return process.env.CLAUDE_HAIKU_MODEL ?? 'claude-haiku-4-5';
  }

  isConfigured(): boolean {
    return this.provider !== 'none';
  }

  private isGemini(): boolean {
    return isGeminiProvider(this.provider);
  }

  private client(): any {
    if (this._client) return this._client;
    if (this.provider === 'anthropic') {
      this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else if (this.provider === 'vertex') {
      this._client = new AnthropicVertex({
        region: process.env.VERTEX_REGION ?? 'us-east5',
        projectId: process.env.GCP_PROJECT_ID,
      });
    } else if (this.isGemini()) {
      // Gemini clients are created per-request in the adapter.
      this._client = { gemini: true };
    } else {
      throw new Error(
        'No AI provider configured (set AI_PROVIDER or ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY / GCP_PROJECT_ID)',
      );
    }
    return this._client;
  }

  /** One smart-model turn. Caller owns the tool-execution loop (see AdaService). */
  async createMessage(params: CreateMessageParams): Promise<any> {
    if (this.isGemini()) {
      const geminiParams = {
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        toolChoice: params.toolChoice,
        model: params.model ?? this.opus,
        maxTokens: params.maxTokens,
      };
      return this.provider === 'gemini_vertex'
        ? geminiVertexCreateMessage(geminiParams)
        : geminiStudioCreateMessage(geminiParams);
    }

    return this.client().messages.create({
      model: params.model ?? this.opus,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools as any } : {}),
      ...(params.toolChoice ? { tool_choice: params.toolChoice as any } : {}),
    });
  }

  /**
   * §2.2 task breakdown via fast model with a forced tool call → guaranteed-valid
   * `BreakdownStep[]`. Throws on any failure so the caller can use its regex
   * fallback.
   */
  async breakdownSteps(title: string, totalSeconds: number, maxSteps = 4): Promise<BreakdownStep[]> {
    const tool: ToolDef = {
      name: 'emit_breakdown',
      description: 'Return 2–4 concrete, ordered microsteps that complete the task.',
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
                title: { type: 'string' },
                duration_seconds: { type: 'integer', minimum: 0 },
              },
              required: ['title', 'duration_seconds'],
            },
          },
        },
        required: ['steps'],
      },
    };

    const messages = [
      {
        role: 'user',
        content:
          `Break this study task into ${maxSteps} or fewer concrete microsteps. ` +
          `Total time is about ${Math.round(totalSeconds / 60)} minutes; split duration_seconds across the steps.\n\n` +
          `Task: ${title}`,
      },
    ];

    const res = this.isGemini()
      ? await (this.provider === 'gemini_vertex'
          ? geminiVertexCreateMessage({
              system: 'You break study tasks into concrete microsteps.',
              messages,
              tools: [tool],
              toolChoice: { type: 'tool', name: 'emit_breakdown' },
              model: this.haiku,
              maxTokens: 1024,
            })
          : geminiStudioCreateMessage({
              system: 'You break study tasks into concrete microsteps.',
              messages,
              tools: [tool],
              toolChoice: { type: 'tool', name: 'emit_breakdown' },
              model: this.haiku,
              maxTokens: 1024,
            }))
      : await this.client().messages.create({
          model: this.haiku,
          max_tokens: 1024,
          tools: [tool as any],
          tool_choice: { type: 'tool', name: 'emit_breakdown' } as any,
          messages,
        });

    const block = (res.content as any[]).find((b) => b.type === 'tool_use');
    const steps = block?.input?.steps;
    if (!Array.isArray(steps) || steps.length === 0) throw new Error('no steps returned');
    return steps.map((s: any) => ({
      title: String(s.title),
      duration_seconds: Number.isInteger(s.duration_seconds) ? s.duration_seconds : 0,
    }));
  }
}
