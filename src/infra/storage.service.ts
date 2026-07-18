import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

const UPLOAD_TTL_MS = 5 * 60_000;
const DOWNLOAD_TTL_MS = 5 * 60_000;

/**
 * §4.4 file storage on GCS. Private user bucket with a 3-step presigned upload
 * (init→PUT→commit), owner-only short-TTL downloads, and a quarantine prefix
 * until a virus scan clears. Prism audio lives in a separate public CDN bucket
 * (§2.11).
 *
 * Unconfigured-safe: when GCS_USER_BUCKET is absent, `isConfigured()` is false
 * and the files feature returns 501 rather than attempting to sign.
 */
@Injectable()
export class StorageService {
  private storage = new Storage();
  private userBucket = process.env.GCS_USER_BUCKET ?? '';

  isConfigured(): boolean {
    return Boolean(this.userBucket);
  }

  /** User-namespaced object key under the quarantine prefix (§4.4). */
  buildKey(userId: string, subjectId: string, fileId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/subjects/${subjectId}/${fileId}/${safe}`;
  }

  /** Object key for uploads staged before their parent record exists yet
   *  (e.g. a syllabus attached during the onboarding wizard, before the
   *  subject it belongs to has been created). */
  buildStagingKey(userId: string, uploadId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/staging/${uploadId}/${safe}`;
  }

  /** Object key for a file attached to an Ada conversation. */
  buildAdaAttachmentKey(userId: string, conversationId: string, fileId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/ada/${conversationId}/${fileId}/${safe}`;
  }

  /** §4.4 step 1: signed PUT URL the client uploads to directly. */
  async presignUpload(key: string, contentType: string): Promise<string> {
    const [url] = await this.storage.bucket(this.userBucket).file(key).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + UPLOAD_TTL_MS,
      contentType,
    });
    return url;
  }

  /** §4.4 owner-only signed download; foreign ids are 404'd in the service layer. */
  async presignDownload(key: string): Promise<string> {
    const [url] = await this.storage.bucket(this.userBucket).file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + DOWNLOAD_TTL_MS,
    });
    return url;
  }
}
