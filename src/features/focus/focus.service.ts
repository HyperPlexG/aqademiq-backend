import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { TasksService } from '../tasks/tasks.service';
import { PrismService } from '../prism/prism.service';
import { StartFocusDto, CheckpointFocusDto, CompleteFocusDto } from './dto/focus.dto';

@Injectable()
export class FocusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
    private readonly tasks: TasksService,
    private readonly prism: PrismService,
  ) {}

  async start(dto: StartFocusDto) {
    // Accepts either a mode key ('rain') or a preset id; 'none'/unknown → null.
    const presetId = await this.prism.resolvePresetId(dto.prism_mode);

    const session = await this.prisma.focusSession.create({
      data: {
        user_id: this.rc.userId,
        planned_duration_mins: dto.planned_min ?? 25,
        prism_preset_id: presetId,
        task_id: dto.task_id ?? null,
        status: 'running',
      },
    });
    return this.dto(session);
  }

  async checkpoint(id: string, dto: CheckpointFocusDto) {
    await this.owned(id);
    const status = dto.status ? dto.status.toLowerCase() : undefined;
    const session = await this.prisma.focusSession.update({
      where: { id },
      data: {
        ...(dto.elapsed_sec !== undefined ? { actual_duration_mins: Math.floor(dto.elapsed_sec / 60) } : {}),
        ...(status !== undefined ? { status: status } : {}),
      },
    });
    return this.dto(session);
  }

  /** POST /:id/complete */
  async complete(id: string, dto: CompleteFocusDto) {
    const existing = await this.owned(id);
    const session = await this.prisma.focusSession.update({
      where: { id },
      data: {
        status: 'completed',
        was_completed: true,
        ...(dto.elapsed_sec !== undefined ? { actual_duration_mins: Math.floor(dto.elapsed_sec / 60) } : {}),
        ...(dto.mood_index !== undefined ? { mood_after: dto.mood_index } : {}),
      },
    });

    let linkedTask = null;
    if (existing.task_id) {
      try {
        linkedTask = await this.tasks.setDone(existing.task_id, true);
      } catch {
        // ignore errors
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
      planned_min: s.planned_duration_mins,
      elapsed_sec: s.actual_duration_mins ? s.actual_duration_mins * 60 : 0,
      status: (s.status ?? '').toUpperCase(),
      prism_mode: s.prism_preset_id ? 'Preset' : null,
      task_id: s.task_id,
      task_date: null,
      mood_index: s.mood_after,
      created_at: s.created_at,
    };
  }
}
