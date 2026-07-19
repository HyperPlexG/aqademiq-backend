// §2.4 — focus sessions (start / checkpoint / complete). Port of src/features/focus/focus.service.ts.
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { prismService } from './prism.service.ts';
import { tasksService } from './tasks.service.ts';

// DB constraint focus_sessions_status_check + focus_sessions_mood_*_check.
// Wire status is UPPERCASE (RUNNING/PAUSED/COMPLETE); stored is lowercase and the
// completed value is 'completed' (not 'complete'). Wire mood_index is 0–4; the
// stored mood_after/mood_before columns are 1–5 (like mood_checkins).
const FOCUS_STATUSES = new Set(['planned', 'running', 'paused', 'completed', 'cancelled']);
function normFocusStatus(wire?: string): string | undefined {
  if (!wire) return undefined;
  let s = wire.toLowerCase();
  if (s === 'complete') s = 'completed';
  return FOCUS_STATUSES.has(s) ? s : undefined;
}
function moodIndexToScore(idx: number): number {
  return Math.min(5, Math.max(1, Math.round(idx) + 1));
}

export interface StartFocusDto {
  planned_min?: number;
  prism_mode?: string;
  task_id?: string;
  task_date?: string;
}

export interface CheckpointFocusDto {
  elapsed_sec?: number;
  status?: string;
}

export interface CompleteFocusDto {
  elapsed_sec?: number;
  mood_index?: number;
}

// deno-lint-ignore no-explicit-any
function dto(s: any) {
  return {
    id: s.id,
    planned_min: s.planned_duration_mins,
    elapsed_sec: s.actual_duration_mins ? s.actual_duration_mins * 60 : 0,
    status: (s.status ?? '').toUpperCase(),
    prism_mode: s.prism_preset_id ? 'Preset' : null,
    task_id: s.task_id,
    task_date: null,
    mood_index: s.mood_after != null ? s.mood_after - 1 : null,
    created_at: s.created_at,
  };
}

async function owned(id: string) {
  const s = await prismaBase().focusSession.findFirst({ where: { id, user_id: RequestContext.userId } });
  if (!s) throw new HttpError(404, 'Focus session not found');
  return s;
}

export const focusService = {
  async start(input: StartFocusDto) {
    // Accepts either a mode key ('rain') or a preset id; 'none'/unknown → null.
    const presetId = await prismService.resolvePresetId(input.prism_mode);

    const session = await prismaBase().focusSession.create({
      data: {
        user_id: RequestContext.userId,
        planned_duration_mins: input.planned_min ?? 25,
        prism_preset_id: presetId,
        task_id: input.task_id ?? null,
        status: 'running',
      },
    });
    return dto(session);
  },

  async checkpoint(id: string, input: CheckpointFocusDto) {
    await owned(id);
    const status = normFocusStatus(input.status);
    const session = await prismaBase().focusSession.update({
      where: { id },
      data: {
        ...(input.elapsed_sec !== undefined ? { actual_duration_mins: Math.floor(input.elapsed_sec / 60) } : {}),
        ...(status !== undefined ? { status: status } : {}),
      },
    });
    return dto(session);
  },

  /** POST /:id/complete */
  async complete(id: string, input: CompleteFocusDto) {
    const existing = await owned(id);
    const session = await prismaBase().focusSession.update({
      where: { id },
      data: {
        status: 'completed',
        was_completed: true,
        ...(input.elapsed_sec !== undefined ? { actual_duration_mins: Math.floor(input.elapsed_sec / 60) } : {}),
        ...(input.mood_index !== undefined ? { mood_after: moodIndexToScore(input.mood_index) } : {}),
      },
    });

    let linkedTask = null;
    if (existing.task_id) {
      try {
        linkedTask = await tasksService.setDone(existing.task_id, true);
      } catch {
        // ignore errors
      }
    }
    return { ...dto(session), linked_task: linkedTask };
  },
};
