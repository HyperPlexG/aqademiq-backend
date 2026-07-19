// §2.3/§4.4 — files (SubjectMaterial) presigned upload/download. Port of
// src/features/files/files.service.ts. Course reads go through the tenant client;
// SubjectMaterial rows use the raw client exactly as the Nest raw-vs-tenant split.
import { prismaBase, tenantDb } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { storage } from '../../_shared/storage.ts';

export interface InitUploadDto {
  subject_id: string;
  name: string;
  kind?: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface InitStagingUploadDto {
  name: string;
  kind?: string;
  mime_type?: string;
  size_bytes?: number;
}

export interface PatchFileDto {
  important?: boolean;
  name?: string;
}

// ---- internals -----------------------------------------------------------

function assertStorage() {
  if (!storage.isConfigured()) {
    throw new HttpError(501, 'File storage is not configured (set GCS_USER_BUCKET)');
  }
}

/** Load a file and verify its course belongs to the caller. */
async function ownedFile(id: string) {
  const file = await prismaBase().subjectMaterial.findFirst({
    where: { id },
    include: { course: true },
  });
  if (!file || file.course.user_id !== RequestContext.userId) {
    throw new HttpError(404, 'File not found');
  }
  return file;
}

function mapKind(kind?: string): string {
  const k = (kind ?? '').toLowerCase();
  const map: Record<string, string> = {
    syllabus: 'syllabus',
    slides: 'lecture_slides',
    notes: 'notes',
    paper: 'past_papers',
  };
  return map[k] ?? 'notes';
}

// deno-lint-ignore no-explicit-any
function dto(f: any) {
  // deno-lint-ignore no-explicit-any
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

export const filesService = {
  /** POST /uploads/init — create the file row and return a signed PUT URL. */
  async initUpload(dtoIn: InitUploadDto) {
    assertStorage();
    const course = await tenantDb().course.findFirst({ where: { id: dtoIn.subject_id } });
    if (!course) throw new HttpError(404, 'Course not found');

    const materialType = mapKind(dtoIn.kind);
    const file = await prismaBase().subjectMaterial.create({
      data: {
        user_id: RequestContext.userId,
        course_id: course.id,
        material_type: materialType,
        file_name: dtoIn.name,
        mime_type: dtoIn.mime_type ?? null,
        file_size_bytes: dtoIn.size_bytes ? BigInt(dtoIn.size_bytes) : null,
        processing_status: 'uploaded',
        metadata: { important: false },
      // deno-lint-ignore no-explicit-any
      } as any,
    });
    const key = storage.buildKey(RequestContext.userId, course.id, file.id, dtoIn.name);
    await prismaBase().subjectMaterial.update({ where: { id: file.id }, data: { file_url: key } });
    const uploadUrl = await storage.presignUpload(key, dtoIn.mime_type ?? 'application/octet-stream');

    return { file_id: file.id, upload_url: uploadUrl, key };
  },

  /** POST /uploads/staging/init — staging upload */
  async initStagingUpload(dtoIn: InitStagingUploadDto) {
    assertStorage();
    const uploadId = crypto.randomUUID();
    const key = storage.buildStagingKey(RequestContext.userId, uploadId, dtoIn.name);
    const uploadUrl = await storage.presignUpload(key, dtoIn.mime_type ?? 'application/octet-stream');
    return { upload_id: uploadId, upload_url: uploadUrl, key, name: dtoIn.name, mime_type: dtoIn.mime_type ?? null };
  },

  /** POST /uploads/:id/commit — finalize after the client PUT. */
  async commitUpload(id: string) {
    assertStorage();
    const file = await ownedFile(id);
    const updated = await prismaBase().subjectMaterial.update({
      where: { id: file.id },
      data: { processing_status: 'ready' },
    });
    return dto(updated);
  },

  /** DELETE /files/:id — hard-delete. */
  async remove(id: string) {
    const file = await ownedFile(id);
    await prismaBase().subjectMaterial.delete({ where: { id: file.id } });
    return { status: 'deleted', id };
  },

  /** PATCH /files/:id — star/important toggle or rename. */
  async patch(id: string, dtoIn: PatchFileDto) {
    const file = await ownedFile(id);
    // deno-lint-ignore no-explicit-any
    const currentMeta = (file.metadata as any) ?? {};
    const updated = await prismaBase().subjectMaterial.update({
      where: { id: file.id },
      data: {
        ...(dtoIn.name !== undefined ? { file_name: dtoIn.name } : {}),
        metadata: {
          ...currentMeta,
          ...(dtoIn.important !== undefined ? { important: dtoIn.important } : {}),
        },
      },
    });
    return dto(updated);
  },

  /** GET /files/:id/download — owner-only short-TTL signed URL. */
  async download(id: string) {
    assertStorage();
    const file = await ownedFile(id);
    if (!file.file_url) throw new HttpError(404, 'File has no stored object');
    const url = await storage.presignDownload(file.file_url);
    return { url, expires_in: 300 };
  },

  /**
   * GET /files/:id/thumbnail — owner-only. There's no server-side resizing
   * pipeline (§4.4 P2), so for images we hand back a short-TTL signed URL to the
   * original object for the client to downscale; for non-images there's no
   * thumbnail and `url` is null (the client falls back to a type icon).
   */
  async thumbnail(id: string) {
    assertStorage();
    const file = await ownedFile(id);
    const isImage = (file.mime_type ?? '').startsWith('image/');
    if (!isImage || !file.file_url) {
      return { url: null, kind: 'none' };
    }
    const url = await storage.presignDownload(file.file_url);
    return { url, kind: 'image', expires_in: 300 };
  },
};
