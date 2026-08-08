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
  awaiting_confirmation_count: number;
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

function hhmmInTz(d: Date, tz: string): string {
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

export async function buildContext(): Promise<AgentContext> {
  const now = new Date();

  const [profile, subjectsRes, tagsRes, openTasks, awaiting] = await Promise.all([
    prismaBase().profile.findUnique({
      where: { id: RequestContext.userId },
      select: { full_name: true, display_name: true, timezone: true, is_guest: true },
    }),
    subjectsService.list().catch(() => ({ subjects: [] })),
    tagsService.list().catch(() => ({ tags: [] })),
    tenantDb().task.count({ where: { status: 'pending' } }).catch(() => 0),
    tenantDb().adaPendingAction.count({ where: { status: 'pending' } }).catch(() => 0),
  ]);

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
  };
}

/** Renders the context block that gets prepended to the agent's system prompt. */
export function renderContext(ctx: AgentContext): string {
  const lines = [
    '## Current state (authoritative — never guess these)',
    `Today is ${ctx.weekday}, ${ctx.today}. Local time ${ctx.now_local} (${ctx.timezone}).`,
    ctx.user_name ? `The user's name is ${ctx.user_name}.` : 'The user has not set a name.',
    ctx.active_semester
      ? `Active semester: "${ctx.active_semester.name}" (id ${ctx.active_semester.id}).`
      : 'No active semester.',
    `Open (pending) tasks: ${ctx.open_task_count}.`,
  ];

  if (ctx.subjects.length) {
    lines.push('', 'Subjects (use these ids verbatim — never invent one):');
    for (const s of ctx.subjects) lines.push(`- ${s.name} → ${s.id}`);
  } else {
    lines.push('', 'The user has no subjects yet. Most task work needs one first.');
  }

  if (ctx.study_tags.length) {
    lines.push('', 'Study tags (use the id as a task `category`):');
    for (const t of ctx.study_tags) lines.push(`- ${t.label} → ${t.id}`);
  }

  if (ctx.awaiting_confirmation_count > 0) {
    lines.push(
      '',
      `NOTE: ${ctx.awaiting_confirmation_count} earlier proposal(s) are still awaiting the user's ` +
        'confirmation. Do not re-propose the same change.',
    );
  }

  return lines.join('\n');
}
