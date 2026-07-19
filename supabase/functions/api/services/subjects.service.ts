// §2.3 — subjects (Course) CRUD + reorder + files. Port of src/features/subjects/subjects.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { occursOn, taskRowToSeries, toUtcDate, ymd, type TaskRowLike } from '../../_shared/occurs-on.ts';

const MS_PER_DAY = 86_400_000;
const LABEL_HORIZON_DAYS = 90;

export interface CreateSubjectDto {
  name: string;
  color_hex: string;
  semester_id?: string;
  code?: string;
  credits?: number;
  prof?: string;
  target_grade?: string;
  mood?: number;
}

export interface UpdateSubjectDto {
  name?: string;
  color_hex?: string;
  semester_id?: string;
  code?: string;
  credits?: number;
  prof?: string;
  target_grade?: string;
  mood?: number;
}

export interface ReorderSubjectsDto {
  ids: string[];
}

export interface AddFileBody {
  name?: string;
  kind?: string;
  important?: boolean;
}

// ---- internals -----------------------------------------------------------

async function owned(id: string) {
  const course = await tenantDb().course.findFirst({
    where: { id },
    include: { subject_materials: true },
  });
  if (!course) throw new HttpError(404, 'Course not found');
  return course;
}

async function resolveSemester(semesterId?: string): Promise<string> {
  if (semesterId) {
    const sem = await tenantDb().academicTerm.findFirst({ where: { id: semesterId } });
    if (!sem) throw new HttpError(422, 'Unknown semester_id');
    return sem.id;
  }
  const active = await tenantDb().academicTerm.findFirst({ where: { is_current: true } });
  if (active) return active.id;
  const any = await tenantDb().academicTerm.findFirst({ orderBy: { start_date: 'desc' } });
  if (any) return any.id;
  return createDefaultSemester();
}

async function createDefaultSemester(): Promise<string> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, 1));
  const sem = await tenantDb().academicTerm.create({
    // deno-lint-ignore no-explicit-any
    data: { name: 'My Semester', start_date: start, end_date: end, is_current: true } as any,
  });
  return sem.id;
}

/** Accepts raw task rows (due_at + JSON repeat_rule) — adapted via taskRowToSeries. */
function computeLabels(rows: Array<TaskRowLike & { title: string; status?: string | null }>) {
  const entries = rows
    .filter((r) => r.status !== 'cancelled')
    .map((r) => ({ title: r.title, series: taskRowToSeries(r) }));

  const todayStr = ymd(new Date());
  const todayD = toUtcDate(todayStr);
  let todayCount = 0;
  for (const e of entries) if (occursOn(e.series, todayStr)) todayCount++;

  let next_label: string | null = null;
  for (let i = 0; i <= LABEL_HORIZON_DAYS && !next_label; i++) {
    const dStr = ymd(new Date(todayD.getTime() + i * MS_PER_DAY));
    const hit = entries.find((e) => occursOn(e.series, dStr));
    if (hit) next_label = hit.title;
  }
  return { next_label, focus_label: todayCount > 0 ? `${todayCount} due today` : null };
}

function humanSize(bytes?: number | null): string | null {
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

// deno-lint-ignore no-explicit-any
function toDto(course: any, series: any[]) {
  const { next_label, focus_label } = computeLabels(series);
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
    // deno-lint-ignore no-explicit-any
    files: materials.map((f: any) => ({
      id: f.id,
      name: f.file_name,
      size_label: humanSize(f.file_size_bytes ? Number(f.file_size_bytes) : null),
      kind: f.material_type,
      // deno-lint-ignore no-explicit-any
      important: (f.metadata as any)?.important ?? false,
    })),
  };
}

export const subjectsService = {
  async list(semesterId?: string) {
    const courses = await tenantDb().course.findMany({
      where: { term_id: semesterId ?? undefined },
      include: { subject_materials: true },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    const ids = courses.map((s) => s.id);
    const series = ids.length
      ? await tenantDb().task.findMany({ where: { course_id: { in: ids } } })
      : [];
    const byCourse = new Map<string, typeof series>();
    for (const ser of series) {
      if (ser.course_id) {
        const arr = byCourse.get(ser.course_id) ?? [];
        arr.push(ser);
        byCourse.set(ser.course_id, arr);
      }
    }
    return { subjects: courses.map((s) => toDto(s, byCourse.get(s.id) ?? [])) };
  },

  async get(id: string) {
    const course = await owned(id);
    const series = await tenantDb().task.findMany({ where: { course_id: id } });
    return toDto(course, series);
  },

  async create(dto: CreateSubjectDto) {
    const termId = await resolveSemester(dto.semester_id);
    const sortOrder = await tenantDb().course.count();
    const created = await tenantDb().course.create({
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
      // deno-lint-ignore no-explicit-any
      } as any,
      include: { subject_materials: true },
    });
    return toDto(created, []);
  },

  async reorder(dto: ReorderSubjectsDto) {
    const owned = await tenantDb().course.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((s) => s.id));
    const missing = dto.ids.filter((id) => !ownedIds.has(id));
    if (missing.length) throw new HttpError(422, `Unknown course ids: ${missing.join(', ')}`);

    await prismaBase().$transaction(
      dto.ids.map((id, index) => prismaBase().course.update({ where: { id }, data: { sort_order: index } })),
    );
    return this.list();
  },

  async update(id: string, dto: UpdateSubjectDto) {
    await owned(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color_hex !== undefined) data.color = dto.color_hex;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.credits !== undefined) data.credits = dto.credits ? Number(dto.credits) : null;
    if (dto.prof !== undefined) data.professor = dto.prof;
    if (dto.target_grade !== undefined) data.target_grade_text = dto.target_grade;
    if (dto.mood !== undefined) data.subject_feeling = dto.mood;
    if (dto.semester_id !== undefined) data.term_id = await resolveSemester(dto.semester_id);

    await tenantDb().course.update({ where: { id }, data });
    return this.get(id);
  },

  async remove(id: string) {
    await owned(id);
    await tenantDb().course.delete({ where: { id } });
    return { status: 'deleted', id };
  },

  async addFile(id: string, body: AddFileBody) {
    const course = await owned(id);
    const kinds = ['syllabus', 'lecture_slides', 'notes', 'past_papers', 'reading_list', 'other'];
    const map: Record<string, string> = {
      syllabus: 'syllabus',
      slides: 'lecture_slides',
      notes: 'notes',
      paper: 'past_papers',
    };
    const kind = kinds.includes(body.kind ?? '') ? (body.kind as string) : (map[body.kind ?? ''] ?? 'notes');
    const file = await prismaBase().subjectMaterial.create({
      data: {
        course_id: course.id,
        user_id: RequestContext.userId,
        file_name: body.name ?? 'Untitled',
        material_type: kind,
        processing_status: 'ready',
        metadata: { important: body.important ?? false },
      },
    });
    return { id: file.id, name: file.file_name, kind: file.material_type, important: body.important ?? false };
  },

  scanFile() {
    throw new Error('Not implemented: subjects.scanFile (§4.4 P1 — needs OCR provider)');
  },
};
