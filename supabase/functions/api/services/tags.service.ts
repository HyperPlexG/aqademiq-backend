// §2.8 — study-tags CRUD + lazy seed. Port of src/features/tags/tags.service.ts.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';

export interface CreateTagDto {
  label: string;
  color?: string;
}

const SEED: Array<{ label: string; color: string }> = [
  { label: 'Lecture', color: '#4F8DFD' },
  { label: 'Class', color: '#7C5CFC' },
  { label: 'Exam', color: '#FF5C7C' },
  { label: 'Assignment', color: '#FFA53C' },
  { label: 'Report', color: '#34C759' },
  { label: 'Presentation', color: '#00B8D9' },
  { label: 'Reading', color: '#8E8E93' },
];

// deno-lint-ignore no-explicit-any
function dto(t: any) {
  return { id: t.id, label: t.name, color: t.color ?? '#8E8E93' };
}

export const tagsService = {
  async list() {
    const existing = await tenantDb().studyTag.findMany({ orderBy: { name: 'asc' } });
    if (existing.length > 0) return { tags: existing.map(dto) };

    await prismaBase().studyTag.createMany({
      data: SEED.map((t) => ({ user_id: RequestContext.userId, name: t.label, color: t.color })),
      skipDuplicates: true,
    });
    const seeded = await tenantDb().studyTag.findMany({ orderBy: { name: 'asc' } });
    return { tags: seeded.map(dto) };
  },

  async create(input: CreateTagDto) {
    const found = await tenantDb().studyTag.findFirst({
      where: { name: { equals: input.label, mode: 'insensitive' } },
    });
    if (found) return dto(found);

    const created = await prismaBase().studyTag.create({
      data: { user_id: RequestContext.userId, name: input.label, color: input.color ?? '#8E8E93' },
    });
    return dto(created);
  },

  async remove(label: string) {
    const found = await tenantDb().studyTag.findFirst({
      where: { name: { equals: label, mode: 'insensitive' } },
    });
    if (!found) throw new HttpError(404, 'Tag not found');
    await prismaBase().studyTag.delete({ where: { id: found.id } });
    return { status: 'deleted', label: found.name };
  },
};
