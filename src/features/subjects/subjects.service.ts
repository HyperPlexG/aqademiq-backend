import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { occursOn, toUtcDate, ymd } from '../tasks/occurs-on';
import { CreateSubjectDto, UpdateSubjectDto, ReorderSubjectsDto } from './dto/subjects.dto';

const MS_PER_DAY = 86_400_000;
const LABEL_HORIZON_DAYS = 90;

/**
 * §2.3 — subjects CRUD. Soft-delete only (task_series FK must stay valid).
 * `next_label`/`focus_label` are derived server-side from the subject's task
 * series via the §4.2 occurrence engine.
 *
 * NOTE (contract): the spec marks these labels "derived" but gives no formula
 * and the Flutter subject_dto.dart isn't available here. Provisional semantics:
 *   next_label  = title of the soonest occurrence in [today, today+90d] (or null)
 *   focus_label = "<n> due today" when n>0, else null
 * Verify/adjust against subject_dto.dart when the client contract is on hand.
 */
@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list(semesterId?: string) {
    const subjects = await this.prisma.tenant.subject.findMany({
      where: { deleted_at: null, ...(semesterId ? { semester_id: semesterId } : {}) },
      include: { files: { where: { deleted_at: null } } },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    const ids = subjects.map((s) => s.id);
    const series = ids.length
      ? await this.prisma.tenant.taskSeries.findMany({ where: { deleted_at: null, subject_id: { in: ids } } })
      : [];
    const bySubject = new Map<string, typeof series>();
    for (const ser of series) {
      const arr = bySubject.get(ser.subject_id) ?? [];
      arr.push(ser);
      bySubject.set(ser.subject_id, arr);
    }
    return { subjects: subjects.map((s) => this.dto(s, bySubject.get(s.id) ?? [])) };
  }

  async get(id: string) {
    const subject = await this.owned(id);
    const series = await this.prisma.tenant.taskSeries.findMany({ where: { deleted_at: null, subject_id: id } });
    return this.dto(subject, series);
  }

  async create(dto: CreateSubjectDto) {
    const semesterId = await this.resolveSemester(dto.semester_id);
    const sortOrder = await this.prisma.tenant.subject.count({ where: { deleted_at: null } });
    const created = await this.prisma.tenant.subject.create({
      // user_id injected by the tenant extension at runtime.
      data: {
        semester_id: semesterId,
        name: dto.name,
        color_hex: dto.color_hex,
        code: dto.code ?? null,
        credits: dto.credits ?? null,
        sort_order: sortOrder,
        ...(dto.prof !== undefined ? { prof: dto.prof } : {}),
        ...(dto.target_grade !== undefined ? { target_grade: dto.target_grade } : {}),
        ...(dto.mood !== undefined ? { mood: dto.mood } : {}),
      } as any,
      include: { files: { where: { deleted_at: null } } },
    });
    return this.dto(created, []);
  }

  /** PATCH /subjects/reorder — subj-sort. Re-numbers sort_order to match the
   *  given order; rejects if any id is unknown or not owned by the caller. */
  async reorder(dto: ReorderSubjectsDto) {
    const owned = await this.prisma.tenant.subject.findMany({
      where: { id: { in: dto.ids }, deleted_at: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const missing = dto.ids.filter((id) => !ownedIds.has(id));
    if (missing.length) throw new UnprocessableEntityException(`Unknown subject ids: ${missing.join(', ')}`);

    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.subject.update({ where: { id }, data: { sort_order: index } })),
    );
    return this.list();
  }

  async update(id: string, dto: UpdateSubjectDto) {
    await this.owned(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color_hex !== undefined) data.color_hex = dto.color_hex;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.credits !== undefined) data.credits = dto.credits;
    if (dto.prof !== undefined) data.prof = dto.prof;
    if (dto.target_grade !== undefined) data.target_grade = dto.target_grade;
    if (dto.mood !== undefined) data.mood = dto.mood;
    if (dto.semester_id !== undefined) data.semester_id = await this.resolveSemester(dto.semester_id);

    await this.prisma.tenant.subject.update({ where: { id }, data });
    return this.get(id);
  }

  /** DELETE /subjects/:id — soft-delete only; task references are preserved. */
  async remove(id: string) {
    await this.owned(id);
    await this.prisma.tenant.subject.update({ where: { id }, data: { deleted_at: new Date() } });
    return { status: 'deleted', id };
  }

  /** POST /subjects/:id/files — add file metadata (no binary; the upload flow
   *  is the files feature). Normalizes kind, maintains files_count. */
  async addFile(id: string, body: { name?: string; kind?: string; important?: boolean }) {
    const subject = await this.owned(id);
    const kinds = ['syllabus', 'slides', 'notes', 'paper'];
    const kind = kinds.includes((body.kind ?? '').toLowerCase()) ? (body.kind as string).toLowerCase() : 'notes';
    const file = await this.prisma.subjectFile.create({
      data: { subject_id: subject.id, name: body.name ?? 'Untitled', kind, important: body.important ?? false },
    });
    await this.prisma.subject.update({ where: { id: subject.id }, data: { files_count: { increment: 1 } } });
    return { id: file.id, name: file.name, kind: file.kind, important: file.important };
  }

  /** §4.4 P1 — OCR scan needs Vision/Textract; deferred. */
  scanFile() {
    throw new Error('Not implemented: subjects.scanFile (§4.4 P1 — needs OCR provider)');
  }

  // ---- internals ---------------------------------------------------------

  private async owned(id: string) {
    const subject = await this.prisma.tenant.subject.findFirst({
      where: { id, deleted_at: null },
      include: { files: { where: { deleted_at: null } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  /** Validate a provided semester or fall back to the active one (422 if none). */
  private async resolveSemester(semesterId?: string): Promise<string> {
    if (semesterId) {
      const sem = await this.prisma.tenant.semester.findFirst({ where: { id: semesterId, deleted_at: null } });
      if (!sem) throw new UnprocessableEntityException('Unknown semester_id');
      return sem.id;
    }
    const active = await this.prisma.tenant.semester.findFirst({ where: { is_current: true, deleted_at: null } });
    if (active) return active.id;
    const any = await this.prisma.tenant.semester.findFirst({ where: { deleted_at: null }, orderBy: { start: 'desc' } });
    if (any) return any.id;
    // First-run resilience: a guest who adds a subject without onboarding has no
    // semester yet — auto-provision a default term and make it active.
    return this.createDefaultSemester();
  }

  private async createDefaultSemester(): Promise<string> {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, 1));
    const sem = await this.prisma.tenant.semester.create({
      // user_id injected by the tenant extension at runtime.
      data: { name: 'My Semester', start, end, is_current: true } as any,
    });
    return sem.id;
  }

  private computeLabels(series: Array<{ title: string; anchor_date: Date; repeat_kind: string; repeat_interval: number; until_date: Date | null }>) {
    const todayStr = ymd(new Date());
    const todayD = toUtcDate(todayStr);
    let todayCount = 0;
    for (const s of series) if (occursOn(s, todayStr)) todayCount++;

    let next_label: string | null = null;
    for (let i = 0; i <= LABEL_HORIZON_DAYS && !next_label; i++) {
      const dStr = ymd(new Date(todayD.getTime() + i * MS_PER_DAY));
      const hit = series.find((s) => occursOn(s, dStr));
      if (hit) next_label = hit.title;
    }
    return { next_label, focus_label: todayCount > 0 ? `${todayCount} due today` : null };
  }

  private humanSize(bytes?: number | null): string | null {
    if (bytes == null) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`;
  }

  private dto(subject: any, series: any[]) {
    const { next_label, focus_label } = this.computeLabels(series);
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code ?? null,
      color_hex: subject.color_hex,
      semester_id: subject.semester_id,
      credits: subject.credits ?? null,
      prof: subject.prof,
      target_grade: subject.target_grade,
      mood: subject.mood,
      files_count: subject.files_count,
      sort_order: subject.sort_order,
      next_label,
      focus_label,
      files: (subject.files ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        size_label: this.humanSize(f.size_bytes),
        kind: f.kind,
        important: f.important,
      })),
    };
  }
}
