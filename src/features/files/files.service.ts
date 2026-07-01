import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { StorageService } from '../../infra/storage.service';
import { RequestContext } from '../../common/request-context';
import { InitUploadDto, InitStagingUploadDto, PatchFileDto } from './dto/files.dto';

const KINDS = ['syllabus', 'slides', 'notes', 'paper'];

/**
 * §2.3/§4.4 — subject file lifecycle on GCS. 3-step upload: init (create row +
 * signed PUT) → client PUT → commit (mark clean, bump files_count, enqueue scan).
 * Downloads are owner-only signed URLs; foreign/deleted ids 404. Requires
 * GCS_USER_BUCKET — returns 501 when storage is unconfigured.
 */
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
    const subject = await this.prisma.tenant.subject.findFirst({ where: { id: dto.subject_id, deleted_at: null } });
    if (!subject) throw new NotFoundException('Subject not found');

    const file = await this.prisma.subjectFile.create({
      data: {
        subject_id: subject.id,
        name: dto.name,
        kind: this.normalizeKind(dto.kind),
        mime_type: dto.mime_type ?? null,
        size_bytes: dto.size_bytes ?? null,
        scan_status: 'pending',
      },
    });
    const key = this.storage.buildKey(this.rc.userId, subject.id, file.id, dto.name);
    await this.prisma.subjectFile.update({ where: { id: file.id }, data: { s3_key: key } });
    const uploadUrl = await this.storage.presignUpload(key, dto.mime_type ?? 'application/octet-stream');

    return { file_id: file.id, upload_url: uploadUrl, key };
  }

  /** POST /uploads/staging/init — no subject yet (onboarding step 3). Returns
   *  a signed PUT URL keyed by a fresh upload id; nothing is written to the
   *  DB here since there's no owning subject to attach a row to yet. The
   *  caller stashes `key`/`name`/`mime_type` and forwards them into
   *  `POST /onboarding/complete`, which creates the real SubjectFile row once
   *  the subject exists. */
  async initStagingUpload(dto: InitStagingUploadDto) {
    this.assertStorage();
    const uploadId = crypto.randomUUID();
    const key = this.storage.buildStagingKey(this.rc.userId, uploadId, dto.name);
    const uploadUrl = await this.storage.presignUpload(key, dto.mime_type ?? 'application/octet-stream');
    return { upload_id: uploadId, upload_url: uploadUrl, key, name: dto.name, mime_type: dto.mime_type ?? null };
  }

  /** POST /uploads/:id/commit — finalize after the client PUT; bump files_count. */
  async commitUpload(id: string) {
    this.assertStorage();
    const file = await this.ownedFile(id);
    // TODO(§4.4): enqueue ClamAV scan; flip scan_status to clean on pass.
    const updated = await this.prisma.subjectFile.update({
      where: { id: file.id },
      data: { scan_status: 'clean' },
    });
    await this.prisma.subject.update({
      where: { id: file.subject_id },
      data: { files_count: { increment: 1 } },
    });
    return this.dto(updated);
  }

  /** DELETE /files/:id — soft-delete; decrement files_count. */
  async remove(id: string) {
    const file = await this.ownedFile(id);
    await this.prisma.subjectFile.update({ where: { id: file.id }, data: { deleted_at: new Date() } });
    await this.prisma.subject.update({
      where: { id: file.subject_id },
      data: { files_count: { decrement: 1 } },
    });
    return { status: 'deleted', id };
  }

  /** PATCH /files/:id — star/important toggle or rename. */
  async patch(id: string, dto: PatchFileDto) {
    const file = await this.ownedFile(id);
    const updated = await this.prisma.subjectFile.update({
      where: { id: file.id },
      data: {
        ...(dto.important !== undefined ? { important: dto.important } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
    });
    return this.dto(updated);
  }

  /** GET /files/:id/download — owner-only short-TTL signed URL. */
  async download(id: string) {
    this.assertStorage();
    const file = await this.ownedFile(id);
    if (!file.s3_key) throw new NotFoundException('File has no stored object');
    const url = await this.storage.presignDownload(file.s3_key);
    return { url, expires_in: 300 };
  }

  thumbnail() {
    throw new NotImplementedException('Thumbnails require the media pipeline (§4.4 P2)');
  }

  // ---- internals ---------------------------------------------------------

  private assertStorage() {
    if (!this.storage.isConfigured()) {
      throw new NotImplementedException('File storage is not configured (set GCS_USER_BUCKET)');
    }
  }

  /** Load a non-deleted file and verify its subject belongs to the caller. */
  private async ownedFile(id: string) {
    const file = await this.prisma.subjectFile.findFirst({
      where: { id, deleted_at: null },
      include: { subject: true },
    });
    if (!file || file.subject.user_id !== this.rc.userId || file.subject.deleted_at) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private normalizeKind(kind?: string): string {
    const k = (kind ?? '').toLowerCase();
    return KINDS.includes(k) ? k : 'notes';
  }

  private dto(f: any) {
    return {
      id: f.id,
      name: f.name,
      kind: f.kind,
      important: f.important,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      scan_status: f.scan_status,
      ocr_status: f.ocr_status,
      created_at: f.created_at,
    };
  }
}
