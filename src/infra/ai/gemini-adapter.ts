import { randomUUID } from 'node:crypto';
import { FunctionCallingMode, VertexAI } from '@google-cloud/vertexai';
import type { Content, Part } from '@google-cloud/vertexai/build/src/types/content';
import { GoogleGenerativeAI, FunctionCallingMode as StudioFunctionCallingMode } from '@google/generative-ai';
import type { Content as StudioContent, Part as StudioPart } from '@google/generative-ai';

export interface GeminiToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface GeminiMessageParams {
  system: string;
  messages: any[];
  tools?: GeminiToolDef[];
  toolChoice?: { type: 'tool'; name: string };
  model: string;
  maxTokens?: number;
}

export interface AnthropicShapedResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: 'tool_use' | 'end_turn';
}

function buildToolUseIndex(messages: any[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block?.type === 'tool_use' && block.id && block.name) {
        index.set(String(block.id), String(block.name));
      }
    }
  }
  return index;
}

function parseToolResultPayload(content: string): object {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null ? parsed : { result: parsed };
  } catch {
    return { result: content };
  }
}

function toGeminiParts(content: unknown, toolUseIndex: Map<string, string>): Part[] {
  if (typeof content === 'string') {
    return content ? [{ text: content }] : [{ text: ' ' }];
  }
  if (!Array.isArray(content)) return [{ text: String(content ?? '') }];

  const parts: Part[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && block.text) {
      parts.push({ text: String(block.text) });
    } else if (block.type === 'tool_use' && block.name) {
      parts.push({
        functionCall: {
          name: String(block.name),
          args: (block.input as object) ?? {},
        },
      });
    } else if (block.type === 'tool_result') {
      const name = toolUseIndex.get(String(block.tool_use_id));
      if (!name) continue;
      parts.push({
        functionResponse: {
          name,
          response: parseToolResultPayload(String(block.content ?? '')),
        },
      });
    }
  }
  return parts.length > 0 ? parts : [{ text: ' ' }];
}

export function toGeminiContents(messages: any[]): Content[] {
  const toolUseIndex = buildToolUseIndex(messages);
  const contents: Content[] = [];
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts = toGeminiParts(msg.content, toolUseIndex);
    if (parts.length === 0) continue;
    contents.push({ role, parts });
  }
  return contents;
}

function toFunctionDeclarations(tools: GeminiToolDef[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }));
}

function toToolConfig(toolChoice?: { type: 'tool'; name: string }, tools?: GeminiToolDef[]) {
  if (toolChoice?.name) {
    return {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: [toolChoice.name],
      },
    };
  }
  if (tools?.length) {
    return {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    };
  }
  return undefined;
}

function toStudioToolConfig(toolChoice?: { type: 'tool'; name: string }, tools?: GeminiToolDef[]) {
  if (toolChoice?.name) {
    return {
      functionCallingConfig: {
        mode: StudioFunctionCallingMode.ANY,
        allowedFunctionNames: [toolChoice.name],
      },
    };
  }
  if (tools?.length) {
    return {
      functionCallingConfig: {
        mode: StudioFunctionCallingMode.AUTO,
      },
    };
  }
  return undefined;
}

export function toAnthropicResponse(parts: Array<Part | StudioPart> | undefined): AnthropicShapedResponse {
  const content: AnthropicShapedResponse['content'] = [];
  let hasToolUse = false;

  for (const part of parts ?? []) {
    if ('text' in part && part.text) {
      content.push({ type: 'text', text: String(part.text) });
    }
    const fnCall = 'functionCall' in part ? part.functionCall : undefined;
    if (fnCall?.name) {
      hasToolUse = true;
      content.push({
        type: 'tool_use',
        id: `call_${randomUUID()}`,
        name: fnCall.name,
        input: (fnCall.args as Record<string, unknown>) ?? {},
      });
    }
  }

  return {
    content,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
  };
}

export async function geminiVertexCreateMessage(params: GeminiMessageParams): Promise<AnthropicShapedResponse> {
  const project = process.env.GCP_PROJECT_ID;
  if (!project) throw new Error('GCP_PROJECT_ID is required for gemini_vertex');

  const vertex = new VertexAI({
    project,
    location: process.env.VERTEX_REGION ?? 'us-east5',
  });

  const tools = params.tools?.length
    ? [{ functionDeclarations: toFunctionDeclarations(params.tools) }]
    : undefined;
  const toolConfig = toToolConfig(params.toolChoice, params.tools);

  const model = vertex.getGenerativeModel({
    model: params.model,
    systemInstruction: params.system,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 2048,
    },
    ...(tools ? { tools: tools as any } : {}),
    ...(toolConfig ? { toolConfig: toolConfig as any } : {}),
  });

  const result = await model.generateContent({
    contents: toGeminiContents(params.messages),
  });

  const parts = result.response.candidates?.[0]?.content?.parts;
  return toAnthropicResponse(parts);
}

export async function geminiStudioCreateMessage(params: GeminiMessageParams): Promise<AnthropicShapedResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is required for gemini_studio');

  const genAI = new GoogleGenerativeAI(apiKey);
  const tools = params.tools?.length
    ? [{ functionDeclarations: toFunctionDeclarations(params.tools) }]
    : undefined;
  const toolConfig = toStudioToolConfig(params.toolChoice, params.tools);

  const model = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: params.system,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 2048,
    },
    ...(tools ? { tools: tools as any } : {}),
    ...(toolConfig ? { toolConfig: toolConfig as any } : {}),
  });

  const studioContents: StudioContent[] = toGeminiContents(params.messages).map((c) => ({
    role: c.role,
    parts: c.parts as StudioPart[],
  }));

  const result = await model.generateContent({ contents: studioContents });
  const parts = result.response.candidates?.[0]?.content?.parts;
  return toAnthropicResponse(parts);
}
