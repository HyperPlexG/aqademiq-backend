import { Injectable } from '@nestjs/common';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import Anthropic from '@anthropic-ai/sdk';

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CreateMessageParams {
  system: string;
  messages: any[];
  tools?: ToolDef[];
  model?: string;
  maxTokens?: number;
}

export interface BreakdownStep {
  title: string;
  duration_seconds: number;
}

type Provider = 'anthropic' | 'vertex' | 'none';

/**
 * §4.3 AI via Claude. Provider-switchable:
 *  - `anthropic` → direct Anthropic API (one API key; no GCP quota gating)
 *  - `vertex`    → Claude on Vertex AI (GCP-native; requires Model Garden + quota)
 * Auto-detected from env when AI_PROVIDER is unset: ANTHROPIC_API_KEY → anthropic,
 * else GCP_PROJECT_ID → vertex, else none (callers fall back gracefully).
 *
 * Universal safety gate (§4.3): no raw LLM output mutates data — Ada proposes,
 * the user confirms, the server validates every field before INSERT. Treat
 * OCR/upload text as untrusted (prompt-injection surface).
 */
@Injectable()
export class ClaudeService {
  readonly provider: Provider;
  private _client: any;
  readonly opus = process.env.CLAUDE_OPUS_MODEL ?? 'claude-opus-4-8';
  readonly haiku = process.env.CLAUDE_HAIKU_MODEL ?? 'claude-haiku-4-5';

  constructor() {
    const explicit = (process.env.AI_PROVIDER as Provider | undefined) || undefined;
    if (explicit && explicit !== 'none') this.provider = explicit;
    else if (process.env.ANTHROPIC_API_KEY) this.provider = 'anthropic';
    else if (process.env.GCP_PROJECT_ID) this.provider = 'vertex';
    else this.provider = 'none';
  }

  isConfigured(): boolean {
    return this.provider !== 'none';
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
    } else {
      throw new Error('No AI provider configured (set ANTHROPIC_API_KEY or GCP_PROJECT_ID)');
    }
    return this._client;
  }

  /** One Opus turn. Caller owns the tool-execution loop (see AdaService). */
  async createMessage(params: CreateMessageParams): Promise<any> {
    return this.client().messages.create({
      model: params.model ?? this.opus,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools as any } : {}),
    });
  }

  /**
   * §2.2 task breakdown via Haiku with a forced tool call → guaranteed-valid
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

    const res = await this.client().messages.create({
      model: this.haiku,
      max_tokens: 1024,
      tools: [tool as any],
      tool_choice: { type: 'tool', name: 'emit_breakdown' } as any,
      messages: [
        {
          role: 'user',
          content:
            `Break this study task into ${maxSteps} or fewer concrete microsteps. ` +
            `Total time is about ${Math.round(totalSeconds / 60)} minutes; split duration_seconds across the steps.\n\n` +
            `Task: ${title}`,
        },
      ],
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
