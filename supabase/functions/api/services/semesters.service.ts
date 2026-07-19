// §2.3 — semesters (AcademicTerm) CRUD + activate. Port of src/features/semesters/semesters.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';

export interface CreateSemesterDto {
  name: string;
  start: string;
  end: string;
}

export interface UpdateSemesterDto {
  name?: string;
  start?: string;
  end?: string;
}

// ---- internals -----------------------------------------------------------

async function resolveActive(): Promise<string | null> {
  const current = await activeSemesterId();
  if (current) {
    const ok = await tenantDb().academicTerm.findFirst({ where: { id: current } });
    if (ok) return current;
  }
  const fallback = await tenantDb().academicTerm.findFirst({
    orderBy: { start_date: 'desc' },
  });
  if (fallback) {
    await setActive(fallback.id);
    return fallback.id;
  }
  return null;
}

async function owned(id: string) {
  const sem = await tenantDb().academicTerm.findFirst({ where: { id } });
  if (!sem) throw new HttpError(404, 'Semester not found');
  return sem;
}

async function activeSemesterId(): Promise<string | null> {
  const sem = await tenantDb().academicTerm.findFirst({ where: { is_current: true } });
  return sem?.id ?? null;
}

async function setActive(id: string | null) {
  await prismaBase().$transaction([
    prismaBase().academicTerm.updateMany({
      where: { user_id: RequestContext.userId, is_current: true },
      data: { is_current: false },
    }),
    ...(id ? [prismaBase().academicTerm.update({ where: { id }, data: { is_current: true } })] : []),
  ]);
}

function assertRange(start: string, end: string) {
  if (!start || !end) return;
  if (date(start).getTime() > date(end).getTime()) {
    throw new HttpError(422, '`start` must be on or before `end`');
  }
}

function date(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toDto(
  s: { id: string; name: string; start_date: Date | null; end_date: Date | null },
  activeId: string | null,
) {
  return {
    id: s.id,
    name: s.name,
    start: s.start_date ? ymd(s.start_date) : '',
    end: s.end_date ? ymd(s.end_date) : '',
    is_active: s.id === activeId,
  };
}

export const semestersService = {
  async list() {
    const [rows, activeId] = await Promise.all([
      tenantDb().academicTerm.findMany({ orderBy: { start_date: 'desc' } }),
      activeSemesterId(),
    ]);
    return { semesters: rows.map((s) => toDto(s, activeId)) };
  },

  /** GET /semesters/active */
  async getActive() {
    const id = await resolveActive();
    if (!id) throw new HttpError(404, 'No semesters yet');
    const sem = await tenantDb().academicTerm.findFirst({ where: { id } });
    if (!sem) throw new HttpError(404, 'No semesters yet');
    return toDto(sem, id);
  },

  async create(dto: CreateSemesterDto) {
    assertRange(dto.start, dto.end);
    const created = await tenantDb().academicTerm.create({
      // deno-lint-ignore no-explicit-any
      data: { name: dto.name, start_date: date(dto.start), end_date: date(dto.end) } as any,
    });
    // First semester becomes active automatically.
    const activeId = await activeSemesterId();
    if (!activeId) await setActive(created.id);
    return toDto(created, (await activeSemesterId()) ?? created.id);
  },

  async update(id: string, dto: UpdateSemesterDto) {
    await owned(id);
    const start = dto.start ?? undefined;
    const end = dto.end ?? undefined;
    if (start || end) {
      const cur = await owned(id);
      assertRange(
        start ?? (cur.start_date ? ymd(cur.start_date) : ''),
        end ?? (cur.end_date ? ymd(cur.end_date) : ''),
      );
    }
    const updated = await tenantDb().academicTerm.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(start ? { start_date: date(start) } : {}),
        ...(end ? { end_date: date(end) } : {}),
      },
    });
    return toDto(updated, await activeSemesterId());
  },

  /** PATCH /semesters/:id/activate */
  async activate(id: string) {
    await owned(id);
    await setActive(id);
    const sem = await owned(id);
    return toDto(sem, id);
  },

  /** DELETE /semesters/:id */
  async remove(id: string) {
    await owned(id);
    const remaining = await tenantDb().academicTerm.count();
    if (remaining <= 1) throw new HttpError(409, 'Cannot delete the last semester');

    await tenantDb().academicTerm.delete({ where: { id } });

    // If the active term was deleted, fall back to the most recent remaining one.
    if ((await activeSemesterId()) === id) {
      const next = await tenantDb().academicTerm.findFirst({
        orderBy: { start_date: 'desc' },
      });
      await setActive(next?.id ?? null);
    }
    return { status: 'deleted', id };
  },
};
