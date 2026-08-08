// Ada agent — durable, cross-conversation memory.
//
// The conversation history in runtime.ts is short-term and session-scoped: 16
// raw messages, gone the moment a new conversation starts. This module is the
// long-term half — a small set of stable facts about how the user works, carried
// into every run regardless of which conversation it happens in.
//
// Three deliberate constraints shape it:
//
//  1. Retrieval is exact, not semantic. Every recalled memory is replayed in the
//     system prompt on every turn, and a semantic store would additionally cost
//     an embedding call per turn — on a free-tier pool that is the wrong trade.
//     Volume per user is dozens of rows, so an indexed query ordered by
//     confidence is enough.
//  2. It is bounded. MAX_RECALLED caps how much prompt the block can occupy, so
//     memory growth can never quietly become the dominant cost of a run.
//  3. Writing a memory does NOT go through the confirmation gate. A memory is
//     Ada's note about the user, not a change to the user's tasks or subjects —
//     the invariant that raw model output never mutates user DATA is untouched.
//     Requiring approval to remember a preference would bury the real proposals
//     under trivia, so instead memories are visible, attributed via `source`, and
//     individually removable.

import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';

/** How many memories may enter the prompt. Caps the per-turn cost of recall. */
const MAX_RECALLED = 20;
/** Long enough for a real constraint, short enough that 20 of them stay cheap. */
export const MAX_MEMORY_CHARS = 240;

export const MEMORY_KINDS = ['preference', 'constraint', 'pattern', 'goal', 'fact'] as const;
export type MemoryKind = typeof MEMORY_KINDS[number];

export interface MemoryRow {
  id: string;
  kind: string;
  content: string;
  subject_id: string | null;
  source: string;
  confidence: number;
}

/**
 * Normalised form used to decide whether two memories are "the same".
 *
 * Without this the agent re-remembers a paraphrase of the same preference every
 * conversation and the context block degenerates into duplicates. Cheap and
 * exact-ish: case, punctuation and spacing are ignored, wording is not.
 */
function normalise(content: string): string {
  return content.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Live memories for this user, most trustworthy first, capped. */
export async function recallMemories(): Promise<MemoryRow[]> {
  const now = new Date();
  const rows = await tenantDb().adaMemory.findMany({
    where: { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
    orderBy: [{ confidence: 'desc' }, { updated_at: 'desc' }],
    take: MAX_RECALLED,
  });
  // deno-lint-ignore no-explicit-any
  return (rows as any[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    content: r.content,
    subject_id: r.subject_id,
    source: r.source,
    confidence: r.confidence,
  }));
}

/**
 * Record that these memories were in play for a run.
 *
 * Best-effort and never awaited on the critical path: the counters exist so a
 * later pass can retire memories nothing ever reads, and losing one update
 * matters far less than adding latency to every turn.
 */
export async function touchMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await tenantDb().adaMemory.updateMany({
      where: { id: { in: ids } },
      data: { use_count: { increment: 1 }, last_used_at: new Date() },
    });
  } catch {
    // Telemetry only — a failure here must never surface to the user.
  }
}

export interface RememberInput {
  kind: MemoryKind;
  content: string;
  subject_id?: string;
  /** 'user' when they stated it outright, 'ada' when inferred. */
  source?: 'user' | 'ada';
  confidence?: number;
  expires_at?: Date;
}

export interface RememberResult {
  id: string;
  /** True when this reinforced an existing memory rather than adding one. */
  updated: boolean;
  content: string;
}

/**
 * Store a memory, reinforcing an existing one when it says the same thing.
 *
 * Reinforcement rather than insert-anyway matters for more than tidiness: a
 * repeated observation is genuinely stronger evidence, so confidence climbs, and
 * the prompt block stays as small as the number of distinct things known.
 */
export async function remember(input: RememberInput): Promise<RememberResult> {
  const content = input.content.trim().slice(0, MAX_MEMORY_CHARS);
  const key = normalise(content);

  // Compared in application code rather than SQL: the match is on the normalised
  // form, which no index covers, and the candidate set is one user's memories.
  //
  // Searched across ALL kinds, not just the incoming one, because the unique
  // index backing this is (user_id, lower(content)) and is not kind-scoped.
  // Narrowing to one kind would let the same sentence filed under a different
  // kind slip past this check and hit the constraint as a raw database error.
  const existing = await tenantDb().adaMemory.findMany({});
  // deno-lint-ignore no-explicit-any
  const match = (existing as any[]).find((r) => normalise(r.content) === key);

  if (match) {
    const updated = await prismaBase().adaMemory.update({
      where: { id: match.id },
      data: {
        // A re-file under a different kind is a correction, so it wins.
        kind: input.kind,
        // Seeing it again is corroboration; a user statement outranks inference.
        confidence: Math.min(5, Math.max(match.confidence, input.confidence ?? match.confidence) + 1),
        source: input.source === 'user' ? 'user' : match.source,
        subject_id: input.subject_id ?? match.subject_id,
        expires_at: input.expires_at ?? match.expires_at,
        updated_at: new Date(),
      },
    });
    return { id: updated.id, updated: true, content: updated.content };
  }

  const created = await prismaBase().adaMemory.create({
    data: {
      user_id: RequestContext.userId,
      kind: input.kind,
      content,
      subject_id: input.subject_id ?? null,
      source: input.source ?? 'ada',
      // An inference starts weaker than something the user said outright.
      confidence: input.confidence ?? (input.source === 'user' ? 4 : 3),
      expires_at: input.expires_at ?? null,
    },
  });
  return { id: created.id, updated: false, content: created.content };
}

/** Drop a memory. Returns false when it was already gone or never theirs. */
export async function forget(id: string): Promise<boolean> {
  const row = await tenantDb().adaMemory.findFirst({ where: { id } });
  if (!row) return false;
  await prismaBase().adaMemory.delete({ where: { id } });
  return true;
}

const KIND_HEADINGS: Record<string, string> = {
  preference: 'How they like to work',
  constraint: 'Hard constraints on their week',
  pattern: 'Patterns worth acting on',
  goal: 'What they are working toward',
  fact: 'Other context',
};

/**
 * The memory block for the system prompt.
 *
 * Grouped by kind so the model can weigh a hard constraint differently from a
 * soft preference, and inferences are marked as such so it does not state a
 * guess back to the user as though they had said it.
 */
export function renderMemories(rows: MemoryRow[], subjectNames: Map<string, string>): string {
  if (rows.length === 0) return '';

  const lines: string[] = [
    '## What you remember about this user',
    'Carried over from earlier conversations. Use it without being asked, but do',
    'not recite it back at them. Items marked (inferred) are your own guesses —',
    'treat them as weaker and correct them if the user says otherwise.',
    'The id in brackets is what `forget` takes.',
  ];

  for (const kind of MEMORY_KINDS) {
    const group = rows.filter((r) => r.kind === kind);
    if (group.length === 0) continue;
    lines.push('', `${KIND_HEADINGS[kind] ?? kind}:`);
    for (const r of group) {
      const subject = r.subject_id ? subjectNames.get(r.subject_id) : null;
      const scope = subject ? ` [${subject}]` : '';
      const inferred = r.source === 'ada' ? ' (inferred)' : '';
      // The id rides inline rather than in a second list: a separate id table
      // would repeat every memory's text and roughly double the cost of this
      // block, which is replayed on every turn of every run.
      lines.push(`- (${r.id}) ${r.content}${scope}${inferred}`);
    }
  }

  return lines.join('\n');
}
