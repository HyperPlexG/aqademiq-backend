import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { occursOn, toUtcDate, ymd } from '../tasks/occurs-on';
import { CreateSubjectDto, UpdateSubjectDto, ReorderSubjectsDto } from './dto/subjects.dto';

const MS_PER_DAY = 86_400_000;
const LABEL_HORIZON_DAYS = 90;

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list(semesterId?: string) {
    const courses = await this.prisma.tenant.course.findMany({
      where: { term_id: semesterId ?? undefined },
      include: { subject_materials: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    const ids = courses.map((s) => s.id);
    const series = ids.length
      ? await this.prisma.tenant.task.findMany({ where: { course_id: { in: ids } } })
      : [];
    const byCourse = new Map<string, typeof series>();
    for (const ser of series) {
      if (ser.course_id) {
        const arr = byCourse.get(ser.course_id) ?? [];
        arr.push(ser);
        byCourse.set(ser.course_id, arr);
      }
    }
    return { subjects: courses.map((s) => this.dto(s, byCourse.get(s.id) ?? [])) };
  }

  async get(id: string) {
    const course = await this.owned(id);
    const series = await this.prisma.tenant.task.findMany({ where: { course_id: id } });
    return this.dto(course, series);
  }

  async create(dto: CreateSubjectDto) {
    const termId = await this.resolveSemester(dto.semester_id);
    const sortOrder = await this.prisma.tenant.course.count();
    const created = await this.prisma.tenant.course.create({
      data: {
        term_id: termId,
        name: dto.name,
        color: dto.color_hex,
        code: dto.code ?? null,
        credits: dto.credits ? Number(dto.credits) : null,
        sort_order: sortOrder,
        professor: dto.prof ?? '',
        target_grade_text: dto.target_grade ?? '',
        subject_feeling: dto.mood ?? 2,
      } as any,
      include: { subject_materials: true },
    });
    return this.dto(created, []);
  }

  async reorder(dto: ReorderSubjectsDto) {
    const owned = await this.prisma.tenant.course.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const missing = dto.ids.filter((id) => !ownedIds.has(id));
    if (missing.length) throw new UnprocessableEntityException(`Unknown course ids: ${missing.join(', ')}`);

    await this.prisma.$transaction(
      dto.ids.map((id, index) => this.prisma.course.update({ where: { id }, data: { sort_order: index } })),
    );
    return this.list();
  }

  async update(id: string, dto: UpdateSubjectDto) {
    await this.owned(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color_hex !== undefined) data.color = dto.color_hex;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.credits !== undefined) data.credits = dto.credits ? Number(dto.credits) : null;
    if (dto.prof !== undefined) data.professor = dto.prof;
    if (dto.target_grade !== undefined) data.target_grade_text = dto.target_grade;
    if (dto.mood !== undefined) data.subject_feeling = dto.mood;
    if (dto.semester_id !== undefined) data.term_id = await this.resolveSemester(dto.semester_id);

    await this.prisma.tenant.course.update({ where: { id }, data });
    return this.get(id);
  }

  async remove(id: string) {
    await this.owned(id);
    await this.prisma.tenant.course.delete({ where: { id } });
    return { status: 'deleted', id };
  }

  async addFile(id: string, body: { name?: string; kind?: string; important?: boolean }) {
    const course = await this.owned(id);
    const kinds = ['syllabus', 'lecture_slides', 'notes', 'past_papers', 'reading_list', 'other'];
    const map: Record<string, string> = {
      syllabus: 'syllabus',
      slides: 'lecture_slides',
      notes: 'notes',
      paper: 'past_papers',
    };
    const kind = kinds.includes(body.kind ?? '') ? (body.kind as string) : (map[body.kind ?? ''] ?? 'notes');
    const file = await this.prisma.subjectMaterial.create({
      data: {
        course_id: course.id,
        user_id: this.rc.userId,
        file_name: body.name ?? 'Untitled',
        material_type: kind,
        processing_status: 'ready',
        metadata: { important: body.important ?? false },
      },
    });
    return { id: file.id, name: file.file_name, kind: file.material_type, important: body.important ?? false };
  }

  scanFile() {
    throw new Error('Not implemented: subjects.scanFile (§4.4 P1 — needs OCR provider)');
  }

  // ---- internals ---------------------------------------------------------

  private async owned(id: string) {
    const course = await this.prisma.tenant.course.findFirst({
      where: { id },
      include: { subject_materials: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async resolveSemester(semesterId?: string): Promise<string> {
    if (semesterId) {
      const sem = await this.prisma.tenant.academicTerm.findFirst({ where: { id: semesterId } });
      if (!sem) throw new UnprocessableEntityException('Unknown semester_id');
      return sem.id;
    }
    const active = await this.prisma.tenant.academicTerm.findFirst({ where: { is_current: true } });
    if (active) return active.id;
    const any = await this.prisma.tenant.academicTerm.findFirst({ orderBy: { start_date: 'desc' } });
    if (any) return any.id;
    return this.createDefaultSemester();
  }

  private async createDefaultSemester(): Promise<string> {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, 1));
    const sem = await this.prisma.tenant.academicTerm.create({
      data: { name: 'My Semester', start_date: start, end_date: end, is_current: true } as any,
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

  private dto(course: any, series: any[]) {
    const { next_label, focus_label } = this.computeLabels(series);
    const materials = course.subject_materials ?? [];
    return {
      id: course.id,
      name: course.name,
      code: course.code ?? null,
      color_hex: course.color,
      semester_id: course.term_id,
      credits: course.credits ? Number(course.credits) : null,
      prof: course.professor,
      target_grade: course.target_grade_text,
      mood: course.subject_feeling,
      files_count: materials.length,
      sort_order: course.sort_order,
      next_label,
      focus_label,
      files: materials.map((f: any) => ({
        id: f.id,
        name: f.file_name,
        size_label: this.humanSize(f.file_size_bytes ? Number(f.file_size_bytes) : null),
        kind: f.material_type,
        important: (f.metadata as any)?.important ?? false,
      })),
    };
  }
}
