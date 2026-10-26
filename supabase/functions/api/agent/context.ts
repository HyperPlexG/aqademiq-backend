// Grounded world-state handed to the agent at the start of every run.
//
// Ada previously ran with NO temporal grounding at all: the chat system prompt
// never told the model what day it was, so it happily scheduled "this weekend"
// into May 2025 and apply-plan wrote those dates straight through. Everything
// here exists so the agent reasons about the user's *actual* present state —
// their date, their timezone, their subjects, their tags — instead of guessing.

import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { subjectsService } from '../services/subjects.service.ts';
import { tagsService } from '../services/tags.service.ts';
import { type MemoryRow, recallMemories, renderMemories, touchMemories } from './memory.ts';
import { buildInsights, type Insights, renderInsights } from './insights.ts';

/** How many earlier turns of this conversation get a one-line recap. */
const DIGEST_RUNS = 6;

export interface AgentContext {
  today: string;
  now_local: string;
  weekday: string;
  timezone: string;
  user_name: string | null;
  is_guest: boolean;
  active_semester: { id: string; name: string } | null;
  subjects: Array<{ id: string; name: string }>;
  study_tags: Array<{ id: string; label: string }>;
  open_task_count: number;
  /** Undecided proposals across ALL of the user's chats. */
  awaiting_confirmation_count: number;
  /**
   * Undecided proposals in THIS chat, with their details. Ada was only ever
   * given a count, so it could not tell that the five tasks it had just been
   * asked for were already waiting — and proposed them again.
   */
  waiting: Array<{ title: string; fields: string }>;
  /** Durable cross-conversation memory (agent/memory.ts). */
  memories: MemoryRow[];
  /** Behaviour derived from their own history (agent/insights.ts). */
  insights: Insights;
  /** What earlier turns of THIS conversation actually did. */
  digest: string[];
  readable_file_count: number;
}

/** YYYY-MM-DD for `d` as seen in `tz`. 'en-CA' formats as ISO by definition. */
export function ymdInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** HH:MM for `d` as seen in `tz`. Exported: scheduling compares a real instant
 *  (a calendar event) against wall-clock task times, so it needs this too. */
export function hhmmInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function weekdayInTz(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
  }
}

/** The user's timezone, defaulting to UTC. Drives every date the agent produces. */
export async function userTimezone(): Promise<string> {
  const profile = await prismaBase().profile.findUnique({
    where: { id: RequestContext.userId },
    select: { timezone: true },
  });
  return profile?.timezone || 'UTC';
}

/**
 * One line per earlier turn of this conversation: what was asked, and what
 * actually got applied.
 *
 * This is the cheap half of continuity. The 16-message replay in runtime.ts
 * carries the recent wording; this carries the OUTCOMES, which is what matters
 * once a conversation is long enough that its opening has scrolled out of the
 * window. Built entirely from rows already written — no summarisation call —
 * because an LLM summary per turn would cost the free-tier quota that the run
 * budget exists to protect.
 */
async function buildDigest(sessionId: string, excludeRunId?: string): Promise<string[]> {
  try {
    const runs = await tenantDb().adaAgentRun.findMany({
      where: { ada_session_id: sessionId, ...(excludeRunId ? { id: { not: excludeRunId } } : {}) },
      orderBy: { created_at: 'desc' },
      take: DIGEST_RUNS,
      select: { id: true, goal: true },
    });
    if (runs.length === 0) return [];

    // Every proposal's fate, not just the applied ones: a run whose cards were
    // still waiting used to read "→ nothing applied", which told the model the
    // request had gone nowhere and invited it to propose everything again.
    const proposals = await tenantDb().adaPendingAction.findMany({
      // deno-lint-ignore no-explicit-any
      where: { run_id: { in: (runs as any[]).map((r) => r.id) }, status: { not: 'superseded' } },
      select: { run_id: true, title: true, status: true },
    });

    const LABEL: Record<string, string> = {
      executed: 'applied', rejected: 'declined', pending: 'waiting', failed: 'failed', approved: 'applying',
    };
    const byRun = new Map<string, Map<string, string[]>>();
    // deno-lint-ignore no-explicit-any
    for (const a of proposals as any[]) {
      const groups = byRun.get(a.run_id) ?? new Map<string, string[]>();
      const label = LABEL[a.status] ?? a.status;
      groups.set(label, [...(groups.get(label) ?? []), a.title]);
      byRun.set(a.run_id, groups);
    }

    // deno-lint-ignore no-explicit-any
    return (runs as any[]).reverse().map((r) => {
      // 300, not 140: a list of five tasks was cut off mid-item.
      const ask = String(r.goal).replace(/\s+/g, ' ').slice(0, 300);
      const groups = byRun.get(r.id);
      if (!groups) return `asked "${ask}" → nothing proposed`;
      return `asked "${ask}" → ${[...groups].map(([label, titles]) => `${label}: ${titles.join('; ')}`).join(' | ')}`;
    });
  } catch {
    // Continuity is a nicety; never fail a run over it.
    return [];
  }
}

export interface BuildContextOptions {
  sessionId?: string;
  /** The run being built for, so it does not recap its own goal back to itself. */
  excludeRunId?: string;
}

export async function buildContext(opts: BuildContextOptions = {}): Promise<AgentContext> {
  const now = new Date();

  const [profile, subjectsRes, tagsRes, openTasks, awaiting, memories, digest, materialCount, insights, waitingRows] = await Promise.all([
    prismaBase().profile.findUnique({
      where: { id: RequestContext.userId },
      select: { full_name: true, display_name: true, timezone: true, is_guest: true },
    }),
    subjectsService.list().catch(() => ({ subjects: [] })),
    tagsService.list().catch(() => ({ tags: [] })),
    tenantDb().task.count({ where: { status: 'pending' } }).catch(() => 0),
    tenantDb().adaPendingAction.count({ where: { status: 'pending' } }).catch(() => 0),
    recallMemories().catch(() => [] as MemoryRow[]),
    opts.sessionId ? buildDigest(opts.sessionId, opts.excludeRunId) : Promise.resolve([]),
    tenantDb().subjectMaterial.count().catch(() => 0),
    buildInsights(),
    opts.sessionId
      ? tenantDb().adaPendingAction.findMany({
        where: { ada_session_id: opts.sessionId, status: 'pending' },
        orderBy: { created_at: 'asc' },
        take: 30,
        select: { title: true, detail: true },
      }).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Fire-and-forget: bumps retrieval counters so a later pass can retire
  // memories nothing ever reads. Never awaited — it must not add turn latency.
  void touchMemories(memories.map((m) => m.id));

  const tz = profile?.timezone || 'UTC';

  // The active term is read straight from settings rather than via
  // semestersService.getActive(), which 404s when the user has none yet.
  let activeSemester: { id: string; name: string } | null = null;
  try {
    const term = await tenantDb().academicTerm.findFirst({ where: { is_current: true } });
    if (term) activeSemester = { id: term.id, name: term.name };
  } catch {
    activeSemester = null;
  }

  return {
    today: ymdInTz(now, tz),
    now_local: hhmmInTz(now, tz),
    weekday: weekdayInTz(now, tz),
    timezone: tz,
    user_name: profile?.full_name ?? profile?.display_name ?? null,
    is_guest: profile?.is_guest ?? RequestContext.isGuest,
    active_semester: activeSemester,
    // deno-lint-ignore no-explicit-any
    subjects: (subjectsRes.subjects as any[]).map((s) => ({ id: s.id, name: s.name })),
    // deno-lint-ignore no-explicit-any
    study_tags: (tagsRes.tags as any[]).map((t) => ({ id: t.id, label: t.label })),
    open_task_count: openTasks,
    awaiting_confirmation_count: awaiting,
    // deno-lint-ignore no-explicit-any
    waiting: (waitingRows as any[]).map((w) => ({
      title: w.title,
      // deno-lint-ignore no-explicit-any
      fields: (Array.isArray(w.detail?.fields) ? w.detail.fields : []).filter((f: any) => f?.to)
        // deno-lint-ignore no-explicit-any
        .map((f: any) => `${f.label}: ${f.to}`).join(', '),
    })),
    memories,
    insights,
    digest,
    readable_file_count: materialCount,
  };
}

/** Renders the context block that gets prepended to the agent's system prompt. */
/**
 * The wall clock — rendered into the last *user message*, never the system prompt.
 *
 * Prompt caching is a strict prefix match: one changed byte invalidates every
 * cached token after it. A minute-resolution clock at the head of the context
 * block therefore invalidated the context, the tools and the whole conversation
 * on every single request — 1,440 times a day, for a value almost no turn reads.
 * It is the most common cache-breaking mistake there is, and Ada had it.
 *
 * Kept out here, the tools + rules + context prefix stays byte-identical between
 * requests and only this one line is re-read. Precision is not sacrificed: the
 * agent still sees the exact minute, just after the cacheable boundary.
 *
 * The *date* stays in the system prompt on purpose — it changes once a day, and
 * every relative date the agent parses ("next Tuesday") is grounded on it.
 */
export function clockLine(ctx: AgentContext): string {
  return `[Local time now: ${ctx.now_local} ${ctx.timezone}.]`;
}

/**
 * The grounded world-state block.
 *
 * **Ordered by how often each part changes, slowest first.** This is not
 * cosmetic. Prompt caching matches on a prefix, so the reusable region ends at
 * the first byte that differs between two requests — putting a counter that
 * moves whenever a task is ticked ahead of the subject list makes the subject
 * list uncacheable too, for nothing. Stable identity and ids go first; the
 * counters and the per-run digest go last, behind the VOLATILE marker.
 *
 * Adding something here? Put it on the correct side of that marker.
 * `npm run ada:tokens` reports where the boundary actually lands.
 */
export function renderContext(ctx: AgentContext): string {
  // ---- stable: identity and ids (changes daily at most) ----
  const lines = [
    '## Current state (authoritative — never guess these)',
    // The clock deliberately does NOT live here — see clockLine() above.
    `Today is ${ctx.weekday}, ${ctx.today} (${ctx.timezone}).`,
    ctx.user_name ? `The user's name is ${ctx.user_name}.` : 'The user has not set a name.',
    ctx.active_semester
      ? `Active semester: "${ctx.active_semester.name}" (id ${ctx.active_semester.id}).`
      : 'No active semester.',
  ];

  // Subjects and tags used to be listed in the same "name → id" shape, and a
  // model put the "R13 Labs" tag's id in `subject_id` five times running. Tags
  // are now given by name only — `category` takes the name — so no tag id is
  // anywhere to be copied into the wrong field.
  if (ctx.subjects.length) {
    lines.push('', "Subjects — courses, for a task's optional `subject_id`, only when the user names one:");
    for (const s of ctx.subjects) lines.push(`- ${s.name} → ${s.id}`);
  } else {
    lines.push('', 'The user has no subjects yet. A task does not need one.');
  }

  if (ctx.study_tags.length) {
    lines.push('', "Study tags — labels, for a task's `category` by name (a tag is not a subject):");
    lines.push(`- ${ctx.study_tags.map((t) => t.label).join(', ')}`);
  }

  // Memories carry their own ids inline (see renderMemories) so `forget` can name
  // one when the user contradicts it, without listing every memory twice.
  const subjectNames = new Map(ctx.subjects.map((s) => [s.id, s.name]));
  const memoryBlock = renderMemories(ctx.memories, subjectNames);
  if (memoryBlock) lines.push('', memoryBlock);

  // Placed after memory so a stated preference is read before an inference drawn
  // from behaviour — what the user says about themselves outranks what the data
  // suggests when the two disagree.
  const insightBlock = renderInsights(ctx.insights);
  if (insightBlock) lines.push('', insightBlock);

  // ---- VOLATILE: everything below moves between requests ----
  // Kept last so nothing above it is invalidated when one of these ticks.
  lines.push('', `Open (pending) tasks: ${ctx.open_task_count}.`);

  if (ctx.waiting.length) {
    lines.push(
      '',
      `Already proposed in this chat and waiting for the user's decision (${ctx.waiting.length}). ` +
        'Do not propose these again. To change one, propose it again with the new details — it replaces the waiting card:',
    );
    for (const w of ctx.waiting) lines.push(`- ${w.title}${w.fields ? ` (${w.fields})` : ''}`);
  }
  const elsewhere = ctx.awaiting_confirmation_count - ctx.waiting.length;
  if (elsewhere > 0) {
    lines.push(`NOTE: ${elsewhere} more proposal(s) are waiting in the user's other chats.`);
  }

  if (ctx.readable_file_count > 0) {
    lines.push(
      `The user has ${ctx.readable_file_count} file(s) attached to their subjects. Files sent in ` +
        'this conversation are readable too — call list_files to see everything, then read_file to open one.',
    );
  }

  // Outcomes of earlier turns, which survive after the raw messages that
  // produced them have scrolled out of the replay window (ADA_HISTORY_LIMIT).
  if (ctx.digest.length) {
    lines.push('', 'Earlier in this conversation:');
    for (const d of ctx.digest) lines.push(`- ${d}`);
  }

  return lines.join('\n');
}
