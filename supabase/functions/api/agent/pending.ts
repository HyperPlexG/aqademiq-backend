// Ada agent — the confirmation gate.
//
// Every create/update/delete the agent wants to make lands here first as an
// `ada_pending_actions` row and stays inert until the user approves it. Nothing
// in this file trusts the row it loaded: `args` is re-parsed through the tool's
// own validator at execution time, so an approval granted several minutes ago
// cannot act on a subject/task that has since been deleted or handed away.
//
// Deliberately free of any import from runtime.ts — the caller (ada.service)
// approves here and then asks the runtime to resume, which keeps the dependency
// one-way and avoids a cycle.

import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { getTool } from './tools.ts';
import { type ActionPreview, type AgentTool, ToolInputError } from './types.ts';

export interface CreatePendingInput {
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  tool: AgentTool;
  // deno-lint-ignore no-explicit-any
  args: any;
  preview: ActionPreview;
}

export async function createPendingAction(input: CreatePendingInput) {
  return await prismaBase().adaPendingAction.create({
    data: {
      user_id: RequestContext.userId,
      ada_session_id: input.sessionId,
      run_id: input.runId,
      message_id: input.messageId,
      tool_name: input.tool.name,
      operation: input.tool.operation ?? 'update',
      resource: input.tool.resource,
      title: input.preview.title.slice(0, 300),
      // Cast: Prisma's InputJsonValue rejects a statically-typed object whose
      // property is an interface array, even though it serialises fine.
      detail: {
        fields: input.preview.fields ?? [],
        ...(input.preview.warning ? { warning: input.preview.warning } : {}),
        // deno-lint-ignore no-explicit-any
      } as any,
      // deno-lint-ignore no-explicit-any
      args: (input.args ?? {}) as any,
      status: 'pending',
    },
  });
}

/** Wire shape for the confirmation card. */
// deno-lint-ignore no-explicit-any
export function pendingDto(row: any) {
  // deno-lint-ignore no-explicit-any
  const detail = (row.detail ?? {}) as any;
  return {
    id: row.id,
    conversation_id: row.ada_session_id,
    run_id: row.run_id,
    message_id: row.message_id,
    tool_name: row.tool_name,
    operation: row.operation,
    resource: row.resource,
    title: row.title,
    fields: Array.isArray(detail.fields) ? detail.fields : [],
    warning: detail.warning ?? null,
    status: row.status,
    error: row.error ?? null,
    created_at: row.created_at,
    decided_at: row.decided_at,
  };
}

/** Everything still awaiting a decision, oldest first. */
export async function listPending(conversationId?: string) {
  const rows = await tenantDb().adaPendingAction.findMany({
    where: { status: 'pending', ...(conversationId ? { ada_session_id: conversationId } : {}) },
    orderBy: { created_at: 'asc' },
  });
  // deno-lint-ignore no-explicit-any
  return { actions: rows.map((r: any) => pendingDto(r)) };
}

/** Every action attached to a run, whatever its state — used to summarise on resume. */
export async function listForRun(runId: string) {
  return await tenantDb().adaPendingAction.findMany({
    where: { run_id: runId },
    orderBy: { created_at: 'asc' },
  });
}

async function loadOwnedPending(id: string) {
  const row = await tenantDb().adaPendingAction.findFirst({ where: { id } });
  if (!row) throw new HttpError(404, 'Action not found');
  return row;
}

export interface DecisionResult {
  // deno-lint-ignore no-explicit-any
  action: any;
  /** Set when the tool ran successfully. */
  result?: unknown;
  /** Set when execution failed — surfaced to the user, and fed back to the agent. */
  error?: string;
}

/**
 * Approve and immediately execute one action.
 *
 * A failure here is recorded on the row and returned rather than thrown: the
 * user's approval was legitimate, the world simply moved on, and the agent is
 * given the error so it can propose a corrected action.
 */
export async function approveAction(id: string): Promise<DecisionResult> {
  const row = await loadOwnedPending(id);
  if (row.status === 'executed') return { action: row, result: row.result };
  if (row.status !== 'pending') {
    throw new HttpError(409, `Action is already ${row.status}`);
  }

  const tool = getTool(row.tool_name);
  if (!tool || tool.kind !== 'write' || !tool.execute) {
    const failed = await markFailed(id, `Tool "${row.tool_name}" is no longer available.`);
    return { action: failed, error: failed.error ?? undefined };
  }

  await prismaBase().adaPendingAction.update({
    where: { id },
    data: { status: 'approved', decided_at: new Date() },
  });

  try {
    // Re-validate against *current* state, not the state at proposal time.
    const args = await tool.parse((row.args ?? {}) as Record<string, unknown>);
    const result = await tool.execute(args);
    const executed = await prismaBase().adaPendingAction.update({
      where: { id },
      data: {
        status: 'executed',
        executed_at: new Date(),
        // deno-lint-ignore no-explicit-any
        result: (result ?? {}) as any,
      },
    });
    return { action: executed, result };
  } catch (e) {
    const message = e instanceof ToolInputError
      ? e.message
      : e instanceof HttpError
      ? e.message
      : e instanceof Error
      ? e.message
      : String(e);
    const failed = await markFailed(id, message);
    return { action: failed, error: message };
  }
}

async function markFailed(id: string, error: string) {
  return await prismaBase().adaPendingAction.update({
    where: { id },
    data: { status: 'failed', decided_at: new Date(), error: error.slice(0, 2000) },
  });
}

export async function rejectAction(id: string): Promise<DecisionResult> {
  const row = await loadOwnedPending(id);
  if (row.status !== 'pending') throw new HttpError(409, `Action is already ${row.status}`);
  const rejected = await prismaBase().adaPendingAction.update({
    where: { id },
    data: { status: 'rejected', decided_at: new Date() },
  });
  return { action: rejected };
}

/**
 * Approve (or reject) every pending action in a conversation, in proposal order.
 *
 * Order matters and sequencing is deliberate: a plan often creates a subject and
 * then tasks against it, so running these concurrently would race.
 */
export async function decideAll(conversationId: string, approve: boolean) {
  const rows = await tenantDb().adaPendingAction.findMany({
    where: { status: 'pending', ada_session_id: conversationId },
    orderBy: { created_at: 'asc' },
  });

  const results: DecisionResult[] = [];
  for (const row of rows) {
    try {
      results.push(approve ? await approveAction(row.id) : await rejectAction(row.id));
    } catch (e) {
      results.push({ action: row, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

/** True when a run has nothing left awaiting a decision. */
export async function runIsUnblocked(runId: string): Promise<boolean> {
  const remaining = await tenantDb().adaPendingAction.count({
    where: { run_id: runId, status: 'pending' },
  });
  return remaining === 0;
}
