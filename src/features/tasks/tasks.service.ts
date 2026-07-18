import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { RevisionService } from '../../infra/revision.service';
import { ClaudeService } from '../../infra/claude.service';
import { RequestContext } from '../../common/request-context';
import { occursOn, parseOccurrenceId, taskRowToSeries, toUtcDate, ymd, dayDiff } from './occurs-on';
import { CreateTaskDto, QueryTasksDto, PatchTaskDto, ToggleTaskDto, MoveTasksDto, BreakdownDto } from './dto/tasks.dto';

const MS_PER_DAY = 86_400_000;
const RANGE_CAP_DAYS = 366;
const COMPLETIONS_TTL = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SeriesLike {
  anchor_date: Date | string | null;
  repeat_kind: string;
  repeat_interval: number;
  until_date?: Date | string | null;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rc: RequestContext,
    private readonly rev: RevisionService,
    private readonly claude: ClaudeService,
  ) {}

  /** GET /tasks?date= | ?from=&to= */
  async query(q: QueryTasksDto) {
    let start: string;
    let end: string;
    if (q.from && q.to) {
      start = q.from;
      end = q.to;
      if (dayDiff(start, end) < 0) throw new BadRequestException('`from` must be <= `to`');
      if (dayDiff(start, end) > RANGE_CAP_DAYS) {
        throw new BadRequestException(`range exceeds ${RANGE_CAP_DAYS}-day horizon cap`);
      }
    } else {
      start = end = q.date ?? this.today();
    }
    return { tasks: await this.materializeRange(start, end) };
  }

  /** POST /tasks */
  async create(dto: CreateTaskDto) {
    const db = this.prisma.tenant;

    let courseId = dto.subject_id;
    if (courseId) {
      const course = await db.course.findFirst({ where: { id: courseId } });
      if (!course) throw new UnprocessableEntityException('Unknown subject_id');
    } else {
      const first = await db.course.findFirst({ orderBy: { name: 'asc' } });
      if (!first) throw new UnprocessableEntityException('No subject available — create a subject first');
      courseId = first.id;
    }

    const anchorStr = dto.date ?? (dto.scheduled_at ? ymd(dto.scheduled_at) : this.today());
    const repeatRule = dto.repeat ? {
      repeat_kind: dto.repeat.kind,
      repeat_interval: dto.repeat.interval ?? 1,
      until_date: dto.until_date ? toUtcDate(dto.until_date) : null,
    } : null;

    const scheduledStart = dto.scheduled_at ? new Date(dto.scheduled_at) : this.parseTimeStr(anchorStr, null);
    const estimatedMins = dto.duration_seconds ? Math.max(1, Math.round(dto.duration_seconds / 60)) : 5;

    const created = await db.task.create({
      data: {
        course_id: courseId,
        title: dto.title,
        estimated_duration_mins: estimatedMins,
        scheduled_start_at: dto.scheduled_at ? scheduledStart : null,
        scheduled_end_at: dto.scheduled_at ? new Date(scheduledStart.getTime() + estimatedMins * 60 * 1000) : null,
        due_at: toUtcDate(anchorStr),
        task_type: dto.category ?? 'general',
        repeat_rule: repeatRule ? JSON.stringify(repeatRule) : null,
        status: 'pending',
        priority: 'medium',
      } as any,
    });

    await this.invalidateCompletions();
    return this.occurrenceDto({ ...created, steps: [] }, anchorStr);
  }

  /** PATCH /tasks/:occ — edit one occurrence */
  async patch(occId: string, dto: PatchTaskDto) {
    const { task, dateStr, isVirtual } = await this.resolveOccurrence(occId);
    
    const dbData: Record<string, any> = {};
    if (dto.scheduled_at !== undefined) {
      if (dto.scheduled_at) {
        const start = new Date(dto.scheduled_at);
        dbData.scheduled_start_at = start;
        const mins = task.estimated_duration_mins ?? 5;
        dbData.scheduled_end_at = new Date(start.getTime() + mins * 60 * 1000);
      } else {
        dbData.scheduled_start_at = null;
        dbData.scheduled_end_at = null;
      }
    }
    if (dto.status !== undefined) {
      dbData.status = dto.status === 'COMPLETE' ? 'completed' : 'pending';
      if (dbData.status === 'completed') {
        dbData.completed_at = new Date();
      } else {
        dbData.completed_at = null;
      }
    }

    if (isVirtual) {
      // Materialize virtual task as a concrete instance override
      const mins = task.estimated_duration_mins ?? 5;
      const start = dbData.scheduled_start_at !== undefined ? dbData.scheduled_start_at : (task.scheduled_start_at ? this.parseTimeStr(dateStr, this.formatTime(task.scheduled_start_at)) : null);
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;
      const status = dbData.status !== undefined ? dbData.status : 'pending';

      const materialized = await this.prisma.task.create({
        data: {
          user_id: this.rc.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          due_at: toUtcDate(dateStr),
          status,
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
          completed_at: status === 'completed' ? new Date() : null,
        },
      });

      await this.invalidateCompletions();
      return this.buildOne(materialized.id, dateStr);
    } else {
      const updated = await this.prisma.task.update({
        where: { id: task.id },
        data: dbData,
      });
      await this.invalidateCompletions();
      return this.buildOne(updated.id, dateStr);
    }
  }

  /** PATCH /tasks/:occ/toggle */
  async toggle(occId: string, _q: ToggleTaskDto) {
    const { task, isVirtual } = await this.resolveOccurrence(occId);
    const nextDone = isVirtual ? true : task.status !== 'completed';
    return this.setDone(occId, nextDone);
  }

  /** Set one occurrence's done state idempotently */
  async setDone(occId: string, done: boolean) {
    const { task, dateStr, isVirtual } = await this.resolveOccurrence(occId);
    const status = done ? 'completed' : 'pending';
    const completedAt = done ? new Date() : null;

    let targetTask: any = task;
    if (isVirtual) {
      const mins = task.estimated_duration_mins ?? 5;
      const start = task.scheduled_start_at ? this.parseTimeStr(dateStr, this.formatTime(task.scheduled_start_at)) : null;
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

      targetTask = await this.prisma.task.create({
        data: {
          user_id: this.rc.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          due_at: toUtcDate(dateStr),
          status,
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
          completed_at: completedAt,
        },
      });
    } else {
      targetTask = await this.prisma.task.update({
        where: { id: task.id },
        data: { status, completed_at: completedAt },
      });
    }

    const eventDate = targetTask.due_at ?? toUtcDate(dateStr);
    await this.adjustActivitySnapshot(eventDate, done ? 1 : -1);

    await this.redis.client.del(`streaks:current:${this.rc.userId}`);
    await this.invalidateCompletions();
    return this.buildOne(targetTask.id, dateStr);
  }

  /** POST /tasks/move */
  async move(dto: MoveTasksDto) {
    let occIds = dto.ids;
    if (!occIds || occIds.length === 0) {
      const dayTasks = await this.materializeRange(dto.from, dto.from);
      occIds = dayTasks.map((t) => t.id);
    }
    const movedTo = toUtcDate(dto.to);
    let moved = 0;
    for (const occId of occIds) {
      const { task, dateStr, isVirtual } = await this.resolveOccurrence(occId).catch(() => ({ task: null, dateStr: '', isVirtual: false }));
      if (!task || task.status === 'cancelled') continue;

      if (isVirtual) {
        const mins = task.estimated_duration_mins ?? 5;
        const start = task.scheduled_start_at ? this.parseTimeStr(dto.to, this.formatTime(task.scheduled_start_at)) : null;
        const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

        await this.prisma.task.create({
          data: {
            user_id: this.rc.userId,
            course_id: task.course_id,
            title: task.title,
            parent_task_id: task.id,
            estimated_duration_mins: mins,
            scheduled_start_at: start,
            scheduled_end_at: end,
            due_at: movedTo,
            status: 'pending',
            priority: task.priority ?? 'medium',
            task_type: task.task_type ?? 'general',
          },
        });
        
        // Cancel the original occurrence slot so it doesn't render twice
        await this.prisma.task.create({
          data: {
            user_id: this.rc.userId,
            course_id: task.course_id,
            title: task.title,
            parent_task_id: task.id,
            estimated_duration_mins: mins,
            due_at: toUtcDate(dateStr),
            status: 'cancelled',
            priority: task.priority ?? 'medium',
            task_type: task.task_type ?? 'general',
          },
        });
      } else {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { due_at: movedTo },
        });
        // Log in rescheduled history
        await this.prisma.taskRescheduleHistory.create({
          data: {
            task_id: task.id,
            old_scheduled_start_at: task.scheduled_start_at,
            old_scheduled_end_at: task.scheduled_end_at,
            new_scheduled_start_at: movedTo,
            new_scheduled_end_at: null,
            reason: 'User moved task',
            changed_by: 'user',
          },
        });
      }
      moved++;
    }
    await this.invalidateCompletions();
    return { moved, from: dto.from, to: dto.to };
  }

  /** DELETE /tasks/:occ */
  async remove(occId: string) {
    const { task, dateStr, isVirtual } = await this.resolveOccurrence(occId);
    if (isVirtual) {
      // Materialize as cancelled/tombstone
      const mins = task.estimated_duration_mins ?? 5;
      await this.prisma.task.create({
        data: {
          user_id: this.rc.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          due_at: toUtcDate(dateStr),
          status: 'cancelled',
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
        },
      });
    } else {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: 'cancelled' },
      });
    }
    await this.invalidateCompletions();
    return { status: 'deleted', id: occId };
  }

  /** POST /tasks/:occ/breakdown */
  async breakdown(occId: string, _dto: BreakdownDto) {
    const { task, dateStr, isVirtual } = await this.resolveOccurrence(occId);
    let targetTaskId = task.id;

    if (isVirtual) {
      // Materialize virtual task to attach steps
      const mins = task.estimated_duration_mins ?? 5;
      const start = task.scheduled_start_at ? this.parseTimeStr(dateStr, this.formatTime(task.scheduled_start_at)) : null;
      const end = start ? new Date(start.getTime() + mins * 60 * 1000) : null;

      const materialized = await this.prisma.task.create({
        data: {
          user_id: this.rc.userId,
          course_id: task.course_id,
          title: task.title,
          parent_task_id: task.id,
          estimated_duration_mins: mins,
          scheduled_start_at: start,
          scheduled_end_at: end,
          due_at: toUtcDate(dateStr),
          status: 'pending',
          priority: task.priority ?? 'medium',
          task_type: task.task_type ?? 'general',
        },
      });
      targetTaskId = materialized.id;
    }

    const durationSeconds = (task.estimated_duration_mins ?? 5) * 60;
    let steps: Array<{ title: string; duration_seconds: number }>;
    if (this.claude.isConfigured()) {
      try {
        steps = await this.claude.breakdownSteps(task.title, durationSeconds);
      } catch {
        steps = this.fallbackStepRows(task.title, durationSeconds);
      }
    } else {
      steps = this.fallbackStepRows(task.title, durationSeconds);
    }

    const rows = steps.map((s, i) => ({
      task_id: targetTaskId,
      title: s.title,
      status: 'pending',
      order_index: i,
    }));

    await this.prisma.taskStep.createMany({ data: rows });
    const createdSteps = await this.prisma.taskStep.findMany({ where: { task_id: targetTaskId } });

    return {
      steps: createdSteps.map((s) => ({
        id: s.id,
        title: s.title,
        duration_seconds: 0,
        status: s.status === 'completed' ? 'COMPLETE' : 'PENDING',
      })),
    };
  }

  /** GET /tasks/history/completions */
  async completions() {
    const cacheKey = `tasks:completions:${this.rc.userId}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const snapshots = await this.prisma.tenant.dailyActivitySnapshot.findMany({
      select: { activity_date: true, tasks_completed: true },
    });
    const counts: Record<string, number> = {};
    for (const s of snapshots) {
      if (s.tasks_completed > 0) {
        counts[ymd(s.activity_date)] = s.tasks_completed;
      }
    }
    await this.redis.client.set(cacheKey, JSON.stringify(counts), 'EX', COMPLETIONS_TTL);
    return counts;
  }

  // ---- internals ---------------------------------------------------------

  private async materializeRange(start: string, end: string) {
    const startD = toUtcDate(start);
    const endD = toUtcDate(end);

    const allTasks = await this.prisma.tenant.task.findMany({
      where: {
        OR: [
          // One-offs or template tasks
          { parent_task_id: null },
          // Concrete override tasks in range
          {
            parent_task_id: { not: null },
            due_at: { gte: startD, lte: endD },
          },
        ],
      },
      include: { steps: true },
    });

    const concreteTasks = allTasks.filter((t) => !t.repeat_rule && t.parent_task_id === null);
    const templateTasks = allTasks.filter((t) => !!t.repeat_rule && t.parent_task_id === null);
    const overrideTasks = allTasks.filter((t) => t.parent_task_id !== null);

    const out = new Map<string, ReturnType<TasksService['occurrenceDto']>>();
    const spanDays = dayDiff(start, end);

    for (let i = 0; i <= spanDays; i++) {
      const dStr = ymd(new Date(startD.getTime() + i * MS_PER_DAY));

      // 1. Process concrete one-off tasks scheduled/due today
      for (const t of concreteTasks) {
        const matchesDate = (t.due_at && ymd(t.due_at) === dStr) || (t.scheduled_start_at && ymd(t.scheduled_start_at) === dStr);
        if (matchesDate && t.status !== 'cancelled') {
          const dto = this.occurrenceDto(t, dStr);
          out.set(dto.id, dto);
        }
      }

      // 2. Process template recurrences
      for (const t of templateTasks) {
        const series = this.getSeriesLike(t);
        if (occursOn(series, dStr)) {
          // Check if there is an override row for this template on this date
          const override = overrideTasks.find((o) => o.parent_task_id === t.id && o.due_at && ymd(o.due_at) === dStr);
          if (override) {
            if (override.status !== 'cancelled') {
              const dto = this.occurrenceDto(override, dStr);
              out.set(dto.id, dto);
            }
          } else {
            // Render virtual occurrence
            const dto = this.occurrenceDto(t, dStr);
            out.set(dto.id, dto);
          }
        }
      }

      // 3. Process override tasks that were moved into today
      for (const o of overrideTasks) {
        if (o.due_at && ymd(o.due_at) === dStr && o.status !== 'cancelled') {
          // If this override task matches today's date, render it
          const parent = templateTasks.find((p) => p.id === o.parent_task_id);
          if (parent) {
            const dto = this.occurrenceDto(o, dStr);
            out.set(dto.id, dto);
          }
        }
      }
    }

    return [...out.values()];
  }

  private occurrenceDto(task: any, dateStr: string) {
    const repeatRule = typeof task.repeat_rule === 'string' ? JSON.parse(task.repeat_rule) : (task.repeat_rule ?? {});
    const repeatKind = repeatRule?.repeat_kind ?? 'none';
    const repeatInterval = repeatRule?.repeat_interval ?? 1;

    const scheduled_at = task.scheduled_start_at ? this.formatTime(task.scheduled_start_at) : null;
    const status = task.status === 'completed' ? 'COMPLETE' : 'PENDING';
    const steps = (task.steps ?? [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((st: any) => ({
        id: st.id,
        title: st.title,
        duration_seconds: 0,
        status: st.status === 'completed' ? 'COMPLETE' : 'PENDING',
      }));

    const isVirtual = task.parent_task_id === null && !!task.repeat_rule;
    const stableId = isVirtual ? `${task.id}@${dateStr}` : task.id;

    return {
      id: stableId,
      title: task.title,
      subject_id: task.course_id,
      duration_seconds: (task.estimated_duration_mins ?? 5) * 60,
      scheduled_at,
      status,
      category: task.task_type ?? 'general',
      repeat: { kind: repeatKind, interval: repeatInterval },
      steps,
    };
  }

  private async resolveOccurrence(occId: string) {
    const parsed = parseOccurrenceId(occId);
    if (parsed) {
      if (!UUID_RE.test(parsed.seriesId)) {
        throw new BadRequestException('Invalid occurrence id — expected <task-id> or <task-id>@<yyyy-MM-dd>');
      }
      const task = await this.prisma.tenant.task.findUnique({
        where: { id: parsed.seriesId },
        include: { steps: true },
      });
      if (!task) throw new NotFoundException('Task template not found');
      return { task, dateStr: parsed.date, isVirtual: true };
    } else {
      if (!UUID_RE.test(occId)) {
        throw new BadRequestException('Invalid occurrence id — expected <task-id> or <task-id>@<yyyy-MM-dd>');
      }
      const task = await this.prisma.tenant.task.findUnique({
        where: { id: occId },
        include: { steps: true },
      });
      if (!task) throw new NotFoundException('Task not found');
      return { task, dateStr: task.due_at ? ymd(task.due_at) : this.today(), isVirtual: false };
    }
  }

  private async buildOne(taskId: string, dateStr: string) {
    const task = await this.prisma.tenant.task.findUnique({
      where: { id: taskId },
      include: { steps: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.occurrenceDto(task, dateStr);
  }

  private getSeriesLike(task: any): SeriesLike {
    return taskRowToSeries(task);
  }

  private async adjustActivitySnapshot(date: Date, diff: number) {
    await this.prisma.dailyActivitySnapshot.upsert({
      where: { user_id_activity_date: { user_id: this.rc.userId, activity_date: date } },
      create: { user_id: this.rc.userId, activity_date: date, tasks_completed: diff > 0 ? diff : 0 },
      update: { tasks_completed: { increment: diff } },
    });
  }

  private fallbackStepRows(title: string, totalSeconds: number): Array<{ title: string; duration_seconds: number }> {
    const t = title.trim() || 'task';
    const titles = [`Plan: ${t}`, `Work on ${t}`, `Review ${t}`];
    const per = Math.max(0, Math.round(totalSeconds / titles.length));
    return titles.map((title) => ({ title, duration_seconds: per }));
  }

  private async invalidateCompletions() {
    await this.redis.client.del(`tasks:completions:${this.rc.userId}`);
    await this.rev.bump(this.rc.userId, 'tasks');
  }

  private today(): string {
    return ymd(new Date());
  }

  private parseTimeStr(dateStr: string, hhmm: string | null): Date {
    const timeStr = hhmm ?? '00:00';
    return new Date(`${dateStr}T${timeStr}:00.000Z`);
  }

  private formatTime(d: Date | null | undefined): string | null {
    if (!d) return null;
    try {
      return d instanceof Date ? d.toISOString().slice(11, 16) : String(d).slice(11, 16);
    } catch {
      return null;
    }
  }
}
