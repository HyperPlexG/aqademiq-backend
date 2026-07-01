import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semesters.dto';

/**
 * §2.3 — semesters with a single active term per user. The active semester is
 * tracked on `semesters.is_current` (at most one true row per user; enforced
 * in `setActive` rather than a DB constraint). Soft-delete only: subjects
 * of a removed term are retained (hidden) so task references stay valid.
 */
@Injectable()
export class SemestersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list() {
    const [rows, activeId] = await Promise.all([
      this.prisma.tenant.semester.findMany({ where: { deleted_at: null }, orderBy: { start: 'desc' } }),
      this.activeSemesterId(),
    ]);
    return { semesters: rows.map((s) => this.dto(s, activeId)) };
  }

  /** GET /semesters/active — exactly one active per user (self-heals if unset). */
  async getActive() {
    const id = await this.resolveActive();
    if (!id) throw new NotFoundException('No semesters yet');
    const sem = await this.prisma.tenant.semester.findFirst({ where: { id, deleted_at: null } });
    if (!sem) throw new NotFoundException('No semesters yet');
    return this.dto(sem, id);
  }

  async create(dto: CreateSemesterDto) {
    this.assertRange(dto.start, dto.end);
    const created = await this.prisma.tenant.semester.create({
      // user_id injected by the tenant extension at runtime.
      data: { name: dto.name, start: this.date(dto.start), end: this.date(dto.end) } as any,
    });
    // First semester becomes active automatically.
    const activeId = await this.activeSemesterId();
    if (!activeId) await this.setActive(created.id);
    return this.dto(created, (await this.activeSemesterId()) ?? created.id);
  }

  async update(id: string, dto: UpdateSemesterDto) {
    await this.owned(id);
    const start = dto.start ?? undefined;
    const end = dto.end ?? undefined;
    if (start || end) {
      const cur = await this.owned(id);
      this.assertRange(start ?? this.ymd(cur.start), end ?? this.ymd(cur.end));
    }
    const updated = await this.prisma.tenant.semester.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(start ? { start: this.date(start) } : {}),
        ...(end ? { end: this.date(end) } : {}),
      },
    });
    return this.dto(updated, await this.activeSemesterId());
  }

  /** PATCH /semesters/:id/activate — make this the single active term. */
  async activate(id: string) {
    await this.owned(id);
    await this.setActive(id);
    const sem = await this.owned(id);
    return this.dto(sem, id);
  }

  /** DELETE /semesters/:id — soft-delete; 409 if it's the last term. */
  async remove(id: string) {
    await this.owned(id);
    const remaining = await this.prisma.tenant.semester.count({ where: { deleted_at: null } });
    if (remaining <= 1) throw new ConflictException('Cannot delete the last semester');

    await this.prisma.tenant.semester.update({ where: { id }, data: { deleted_at: new Date() } });

    // If the active term was deleted, fall back to the most recent remaining one.
    if ((await this.activeSemesterId()) === id) {
      const next = await this.prisma.tenant.semester.findFirst({
        where: { deleted_at: null },
        orderBy: { start: 'desc' },
      });
      await this.setActive(next?.id ?? null);
    }
    return { status: 'deleted', id };
  }

  // ---- internals ---------------------------------------------------------

  /** Ensure an active id exists when possible, persisting the self-heal. */
  private async resolveActive(): Promise<string | null> {
    const current = await this.activeSemesterId();
    if (current) {
      const ok = await this.prisma.tenant.semester.findFirst({ where: { id: current, deleted_at: null } });
      if (ok) return current;
    }
    const fallback = await this.prisma.tenant.semester.findFirst({
      where: { deleted_at: null },
      orderBy: { start: 'desc' },
    });
    if (fallback) {
      await this.setActive(fallback.id);
      return fallback.id;
    }
    return null;
  }

  private async owned(id: string) {
    const sem = await this.prisma.tenant.semester.findFirst({ where: { id, deleted_at: null } });
    if (!sem) throw new NotFoundException('Semester not found');
    return sem;
  }

  private async activeSemesterId(): Promise<string | null> {
    const sem = await this.prisma.tenant.semester.findFirst({ where: { is_current: true, deleted_at: null } });
    return sem?.id ?? null;
  }

  private async setActive(id: string | null) {
    await this.prisma.$transaction([
      this.prisma.semester.updateMany({
        where: { user_id: this.rc.userId, is_current: true },
        data: { is_current: false },
      }),
      ...(id ? [this.prisma.semester.update({ where: { id }, data: { is_current: true } })] : []),
    ]);
  }

  private assertRange(start: string, end: string) {
    if (this.date(start).getTime() > this.date(end).getTime()) {
      throw new UnprocessableEntityException('`start` must be on or before `end`');
    }
  }

  private date(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private dto(s: { id: string; name: string; start: Date; end: Date }, activeId: string | null) {
    return {
      id: s.id,
      name: s.name,
      start: this.ymd(s.start),
      end: this.ymd(s.end),
      is_active: s.id === activeId,
    };
  }
}
