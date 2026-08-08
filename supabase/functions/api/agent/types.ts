// Ada agent — shared types.
//
// The contract every tool obeys:
//   read  tools run immediately and hand their result back to the agent.
//   write tools NEVER run during a turn. They are parsed, previewed, and parked
//         as an `ada_pending_actions` row; only an explicit user approval
//         executes them (see agent/pending.ts).
//
// `parse` is deliberately called twice for writes — once when proposing (so the
// agent gets an actionable error it can correct mid-turn) and again at execution
// time (so an approval granted minutes ago can't act on state that has since
// changed, e.g. a subject the user deleted in between).

export type ToolKind = 'read' | 'write';
export type Operation = 'create' | 'update' | 'delete';

/** One line of the diff rendered on the confirmation card. */
export interface PreviewField {
  label: string;
  from?: string | null;
  to?: string | null;
}

export interface ActionPreview {
  /** One-line human summary, e.g. "Move 3 tasks from Mon 11 Aug to Tue 12 Aug". */
  title: string;
  fields?: PreviewField[];
  /** Shown in red on the card — irreversible or wide-reaching effects. */
  warning?: string;
}

/**
 * Raised by a tool's `parse` when the model's input is wrong in a way the model
 * can fix (unknown id, bad date, missing field). It is fed back into the loop as
 * an observation instead of aborting the run — this is what lets the agent
 * self-correct rather than dead-ending on its first mistake.
 */
export class ToolInputError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  kind: ToolKind;
  /** Data family this touches — surfaced on the confirmation card. */
  resource: string;
  /** Required for `kind: 'write'`. */
  operation?: Operation;
  /** Validate + normalise raw model input. Throws ToolInputError on bad input. */
  // deno-lint-ignore no-explicit-any
  parse(input: Record<string, unknown>): Promise<any>;
  /** `kind: 'read'` only — execute and return data for the agent. */
  // deno-lint-ignore no-explicit-any
  run?(args: any): Promise<unknown>;
  /** `kind: 'write'` only — describe the change for the user. */
  // deno-lint-ignore no-explicit-any
  preview?(args: any): Promise<ActionPreview>;
  /** `kind: 'write'` only — perform the change, after approval. */
  // deno-lint-ignore no-explicit-any
  execute?(args: any): Promise<unknown>;
}

/** A step the agent committed to at the start of the run. */
export interface PlanStep {
  step: string;
  status: 'pending' | 'done' | 'blocked';
}

/** What one agent phase cost. Recorded even on failure — the quota was spent. */
export interface AgentUsage {
  prompt_tokens: number;
  completion_tokens: number;
  /** Provider calls made in this phase. */
  llm_calls: number;
  /** Model that served the last call, for per-message attribution. */
  model: string | null;
}

export interface AgentOutcome {
  run_id: string;
  status: 'completed' | 'awaiting_confirmation' | 'failed';
  /** The assistant text shown in the chat. */
  text: string;
  plan: PlanStep[];
  /** Ids of ada_pending_actions rows created this turn. */
  pending_action_ids: string[];
  usage: AgentUsage;
}
