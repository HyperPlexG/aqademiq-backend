import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { RequestContext } from '../../common/request-context';
import { InitUploadDto, InitStagingUploadDto, PatchFileDto } from './dto/files.dto';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly rc: RequestContext,
  ) {}

  /** POST /uploads/init — create the file row and return a signed PUT URL. */
  async initUpload(dto: InitUploadDto) {
    this.assertStorage();
    const course = await this.prisma.tenant.course.findFirst({ where: { id: dto.subject_id } });
    if (!course) throw new NotFoundException('Course not found');

    const materialType = this.mapKind(dto.kind);
    const file = await this.prisma.subjectMaterial.create({
      data: {
        user_id: this.rc.userId,
        course_id: course.id,
        material_type: materialType,
        file_name: dto.name,
        mime_type: dto.mime_type ?? null,
        file_size_bytes: dto.size_bytes ? BigInt(dto.size_bytes) : null,
        processing_status: 'uploaded',
        metadata: { important: false },
      },
    });
    const key = this.storage.buildKey(this.rc.userId, course.id, file.id, dto.name);
    await this.prisma.subjectMaterial.update({ where: { id: file.id }, data: { file_url: key } });
    const uploadUrl = await this.storage.presignUpload(key, dto.mime_type ?? 'application/octet-stream');

    return { file_id: file.id, upload_url: uploadUrl, key };
  }

  /** POST /uploads/staging/init — staging upload */
  async initStagingUpload(dto: InitStagingUploadDto) {
    this.assertStorage();
    const uploadId = crypto.randomUUID();
    const key = this.storage.buildStagingKey(this.rc.userId, uploadId, dto.name);
    const uploadUrl = await this.storage.presignUpload(key, dto.mime_type ?? 'application/octet-stream');
    return { upload_id: uploadId, upload_url: uploadUrl, key, name: dto.name, mime_type: dto.mime_type ?? null };
  }

  /** POST /uploads/:id/commit — finalize after the client PUT. */
  async commitUpload(id: string) {
    this.assertStorage();
    const file = await this.ownedFile(id);
    const updated = await this.prisma.subjectMaterial.update({
      where: { id: file.id },
      data: { processing_status: 'ready' },
    });
    return this.dto(updated);
  }

  /** DELETE /files/:id — hard-delete. */
  async remove(id: string) {
    const file = await this.ownedFile(id);
    await this.prisma.subjectMaterial.delete({ where: { id: file.id } });
    return { status: 'deleted', id };
  }

  /** PATCH /files/:id — star/important toggle or rename. */
  async patch(id: string, dto: PatchFileDto) {
    const file = await this.ownedFile(id);
    const currentMeta = (file.metadata as any) ?? {};
    const updated = await this.prisma.subjectMaterial.update({
      where: { id: file.id },
      data: {
        ...(dto.name !== undefined ? { file_name: dto.name } : {}),
        metadata: {
          ...currentMeta,
          ...(dto.important !== undefined ? { important: dto.important } : {}),
        },
      },
    });
    return this.dto(updated);
  }

  /** GET /files/:id/download — owner-only short-TTL signed URL. */
  async download(id: string) {
    this.assertStorage();
    const file = await this.ownedFile(id);
    if (!file.file_url) throw new NotFoundException('File has no stored object');
    const url = await this.storage.presignDownload(file.file_url);
    return { url, expires_in: 300 };
  }

  /**
   * GET /files/:id/thumbnail — owner-only. There's no server-side resizing
   * pipeline (§4.4 P2), so for images we hand back a short-TTL signed URL to the
   * original object for the client to downscale; for non-images there's no
   * thumbnail and `url` is null (the client falls back to a type icon).
   */
  async thumbnail(id: string) {
    this.assertStorage();
    const file = await this.ownedFile(id);
    const isImage = (file.mime_type ?? '').startsWith('image/');
    if (!isImage || !file.file_url) {
      return { url: null, kind: 'none' };
    }
    const url = await this.storage.presignDownload(file.file_url);
    return { url, kind: 'image', expires_in: 300 };
  }

  // ---- internals ---------------------------------------------------------

  private assertStorage() {
    if (!this.storage.isConfigured()) {
      throw new NotImplementedException('File storage is not configured (set GCS_USER_BUCKET)');
    }
  }

  /** Load a file and verify its course belongs to the caller. */
  private async ownedFile(id: string) {
    const file = await this.prisma.subjectMaterial.findFirst({
      where: { id },
      include: { course: true },
    });
    if (!file || file.course.user_id !== this.rc.userId) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private mapKind(kind?: string): string {
    const k = (kind ?? '').toLowerCase();
    const map: Record<string, string> = {
      syllabus: 'syllabus',
      slides: 'lecture_slides',
      notes: 'notes',
      paper: 'past_papers',
    };
    return map[k] ?? 'notes';
  }

  private dto(f: any) {
    const important = (f.metadata as any)?.important ?? false;
    const kindMap: Record<string, string> = {
      syllabus: 'syllabus',
      lecture_slides: 'slides',
      notes: 'notes',
      past_papers: 'paper',
      reading_list: 'notes',
      other: 'notes',
    };
    return {
      id: f.id,
      name: f.file_name,
      kind: kindMap[f.material_type] ?? 'notes',
      important: important,
      mime_type: f.mime_type,
      size_bytes: f.file_size_bytes ? Number(f.file_size_bytes) : null,
      scan_status: f.processing_status === 'ready' ? 'clean' : 'pending',
      ocr_status: 'none',
      created_at: f.uploaded_at,
    };
  }
}
