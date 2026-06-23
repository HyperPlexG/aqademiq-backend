import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { CreateTagDto } from './dto/tags.dto';

/** §2.8 default study tags, seeded on first access. */
const SEED: Array<{ label: string; color: string }> = [
  { label: 'Lecture', color: '#4F8DFD' },
  { label: 'Class', color: '#7C5CFC' },
  { label: 'Exam', color: '#FF5C7C' },
  { label: 'Assignment', color: '#FFA53C' },
  { label: 'Report', color: '#34C759' },
  { label: 'Presentation', color: '#00B8D9' },
  { label: 'Reading', color: '#8E8E93' },
];

/** §2.8 — study tags. UNIQUE(user_id, label) with case-insensitive dedup in
 *  code. Seven defaults are seeded lazily on first list. */
@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list() {
    const existing = await this.prisma.tenant.studyTag.findMany({ orderBy: { label: 'asc' } });
    if (existing.length > 0) return { tags: existing.map(this.dto) };

    // Seed defaults once; skipDuplicates guards against races.
    await this.prisma.studyTag.createMany({
      data: SEED.map((t) => ({ user_id: this.rc.userId, label: t.label, color: t.color })),
      skipDuplicates: true,
    });
    const seeded = await this.prisma.tenant.studyTag.findMany({ orderBy: { label: 'asc' } });
    return { tags: seeded.map(this.dto) };
  }

  /** POST /study-tags — case-insensitive dedup (idempotent on existing label). */
  async create(dto: CreateTagDto) {
    const found = await this.prisma.tenant.studyTag.findFirst({
      where: { label: { equals: dto.label, mode: 'insensitive' } },
    });
    if (found) return this.dto(found);

    const created = await this.prisma.studyTag.create({
      data: { user_id: this.rc.userId, label: dto.label, color: dto.color ?? '#8E8E93' },
    });
    return this.dto(created);
  }

  /** DELETE /study-tags/:label — case-insensitive. */
  async remove(label: string) {
    const found = await this.prisma.tenant.studyTag.findFirst({
      where: { label: { equals: label, mode: 'insensitive' } },
    });
    if (!found) throw new NotFoundException('Tag not found');
    await this.prisma.studyTag.delete({ where: { id: found.id } });
    return { status: 'deleted', label: found.label };
  }

  private dto(t: { id: string; label: string; color: string }) {
    return { id: t.id, label: t.label, color: t.color };
  }
}
