import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { CreateTagDto } from './dto/tags.dto';

const SEED: Array<{ label: string; color: string }> = [
  { label: 'Lecture', color: '#4F8DFD' },
  { label: 'Class', color: '#7C5CFC' },
  { label: 'Exam', color: '#FF5C7C' },
  { label: 'Assignment', color: '#FFA53C' },
  { label: 'Report', color: '#34C759' },
  { label: 'Presentation', color: '#00B8D9' },
  { label: 'Reading', color: '#8E8E93' },
];

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  async list() {
    const existing = await this.prisma.tenant.studyTag.findMany({ orderBy: { name: 'asc' } });
    if (existing.length > 0) return { tags: existing.map(this.dto) };

    await this.prisma.studyTag.createMany({
      data: SEED.map((t) => ({ user_id: this.rc.userId, name: t.label, color: t.color })),
      skipDuplicates: true,
    });
    const seeded = await this.prisma.tenant.studyTag.findMany({ orderBy: { name: 'asc' } });
    return { tags: seeded.map(this.dto) };
  }

  async create(dto: CreateTagDto) {
    const found = await this.prisma.tenant.studyTag.findFirst({
      where: { name: { equals: dto.label, mode: 'insensitive' } },
    });
    if (found) return this.dto(found);

    const created = await this.prisma.studyTag.create({
      data: { user_id: this.rc.userId, name: dto.label, color: dto.color ?? '#8E8E93' },
    });
    return this.dto(created);
  }

  async remove(label: string) {
    const found = await this.prisma.tenant.studyTag.findFirst({
      where: { name: { equals: label, mode: 'insensitive' } },
    });
    if (!found) throw new NotFoundException('Tag not found');
    await this.prisma.studyTag.delete({ where: { id: found.id } });
    return { status: 'deleted', label: found.name };
  }

  private dto(t: any) {
    return { id: t.id, label: t.name, color: t.color ?? '#8E8E93' };
  }
}
