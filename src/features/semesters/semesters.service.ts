import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semesters.dto';

@Injectable()
export class SemestersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list() {
    const [rows, activeId] = await Promise.all([
      this.prisma.tenant.academicTerm.findMany({ orderBy: { start_date: 'desc' } }),
      this.activeSemesterId(),
    ]);
    return { semesters: rows.map((s) => this.dto(s, activeId)) };
  }

  /** GET /semesters/active */
  async getActive() {
    const id = await this.resolveActive();
    if (!id) throw new NotFoundException('No semesters yet');
    const sem = await this.prisma.tenant.academicTerm.findFirst({ where: { id } });
    if (!sem) throw new NotFoundException('No semesters yet');
    return this.dto(sem, id);
  }

  async create(dto: CreateSemesterDto) {
    this.assertRange(dto.start, dto.end);
    const created = await this.prisma.tenant.academicTerm.create({
      data: { name: dto.name, start_date: this.date(dto.start), end_date: this.date(dto.end) } as any,
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
      this.assertRange(
        start ?? (cur.start_date ? this.ymd(cur.start_date) : ''),
        end ?? (cur.end_date ? this.ymd(cur.end_date) : '')
      );
    }
    const updated = await this.prisma.tenant.academicTerm.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(start ? { start_date: this.date(start) } : {}),
        ...(end ? { end_date: this.date(end) } : {}),
      },
    });
    return this.dto(updated, await this.activeSemesterId());
  }

  /** PATCH /semesters/:id/activate */
  async activate(id: string) {
    await this.owned(id);
    await this.setActive(id);
    const sem = await this.owned(id);
    return this.dto(sem, id);
  }

  /** DELETE /semesters/:id */
  async remove(id: string) {
    await this.owned(id);
    const remaining = await this.prisma.tenant.academicTerm.count();
    if (remaining <= 1) throw new ConflictException('Cannot delete the last semester');

    await this.prisma.tenant.academicTerm.delete({ where: { id } });

    // If the active term was deleted, fall back to the most recent remaining one.
    if ((await this.activeSemesterId()) === id) {
      const next = await this.prisma.tenant.academicTerm.findFirst({
        orderBy: { start_date: 'desc' },
      });
      await this.setActive(next?.id ?? null);
    }
    return { status: 'deleted', id };
  }

  // ---- internals ---------------------------------------------------------

  private async resolveActive(): Promise<string | null> {
    const current = await this.activeSemesterId();
    if (current) {
      const ok = await this.prisma.tenant.academicTerm.findFirst({ where: { id: current } });
      if (ok) return current;
    }
    const fallback = await this.prisma.tenant.academicTerm.findFirst({
      orderBy: { start_date: 'desc' },
    });
    if (fallback) {
      await this.setActive(fallback.id);
      return fallback.id;
    }
    return null;
  }

  private async owned(id: string) {
    const sem = await this.prisma.tenant.academicTerm.findFirst({ where: { id } });
    if (!sem) throw new NotFoundException('Semester not found');
    return sem;
  }

  private async activeSemesterId(): Promise<string | null> {
    const sem = await this.prisma.tenant.academicTerm.findFirst({ where: { is_current: true } });
    return sem?.id ?? null;
  }

  private async setActive(id: string | null) {
    await this.prisma.$transaction([
      this.prisma.academicTerm.updateMany({
        where: { user_id: this.rc.userId, is_current: true },
        data: { is_current: false },
      }),
      ...(id ? [this.prisma.academicTerm.update({ where: { id }, data: { is_current: true } })] : []),
    ]);
  }

  private assertRange(start: string, end: string) {
    if (!start || !end) return;
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

  private dto(s: { id: string; name: string; start_date: Date | null; end_date: Date | null }, activeId: string | null) {
    return {
      id: s.id,
      name: s.name,
      start: s.start_date ? this.ymd(s.start_date) : '',
      end: s.end_date ? this.ymd(s.end_date) : '',
      is_active: s.id === activeId,
    };
  }
}
