import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { TasksService } from '../tasks/tasks.service';
import { occurrenceId } from '../tasks/occurs-on';
import { StartFocusDto, CheckpointFocusDto, CompleteFocusDto } from './dto/focus.dto';

/**
 * §2.4 — focus (Pomodoro) sessions. Runs client-side, synced at checkpoints.
 * On complete, the linked task occurrence is atomically marked done (the P0
 * Focus→Plan "done sync"), routed through TasksService.setDone so it also feeds
 * the activity ledger / streak.
 */
@Injectable()
export class FocusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly tasks: TasksService,
  ) {}

  async start(dto: StartFocusDto) {
    const session = await this.prisma.focusSession.create({
      data: {
        user_id: this.rc.userId,
        planned_min: dto.planned_min ?? 25,
        prism_mode: dto.prism_mode ?? null,
        task_id: dto.task_id ?? null,
        task_date: dto.task_date ? new Date(`${dto.task_date}T00:00:00.000Z`) : null,
        status: 'RUNNING',
      },
    });
    return this.dto(session);
  }

  async checkpoint(id: string, dto: CheckpointFocusDto) {
    await this.owned(id);
    const session = await this.prisma.focusSession.update({
      where: { id },
      data: {
        ...(dto.elapsed_sec !== undefined ? { elapsed_sec: dto.elapsed_sec } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return this.dto(session);
  }

  /** POST /:id/complete — mark COMPLETE, capture mood, and done-sync the task. */
  async complete(id: string, dto: CompleteFocusDto) {
    const existing = await this.owned(id);
    const session = await this.prisma.focusSession.update({
      where: { id },
      data: {
        status: 'COMPLETE',
        ...(dto.elapsed_sec !== undefined ? { elapsed_sec: dto.elapsed_sec } : {}),
        ...(dto.mood_index !== undefined ? { mood_index: dto.mood_index } : {}),
      },
    });

    // §2.4 P0 done-sync: if a task occurrence is linked, mark it complete.
    let linkedTask = null;
    if (existing.task_id && existing.task_date) {
      const occId = occurrenceId(existing.task_id, existing.task_date);
      try {
        linkedTask = await this.tasks.setDone(occId, true);
      } catch {
        // Linked occurrence may have been deleted/moved — don't fail completion.
      }
    }
    return { ...this.dto(session), linked_task: linkedTask };
  }

  // ---- internals ---------------------------------------------------------

  private async owned(id: string) {
    const s = await this.prisma.focusSession.findFirst({ where: { id, user_id: this.rc.userId } });
    if (!s) throw new NotFoundException('Focus session not found');
    return s;
  }

  private dto(s: any) {
    return {
      id: s.id,
      planned_min: s.planned_min,
      elapsed_sec: s.elapsed_sec,
      status: s.status,
      prism_mode: s.prism_mode,
      task_id: s.task_id,
      task_date: s.task_date ? s.task_date.toISOString().slice(0, 10) : null,
      mood_index: s.mood_index,
      created_at: s.created_at,
    };
  }
}
