// §4.4 file storage. Port of src/infra/storage.service.ts, retargeted from GCS to
// Supabase Storage (private `user-assets` bucket). Presigned upload (signed PUT
// token) + owner-only short-TTL signed download, both via the Storage REST API
// with the service-role key.
//
// Unconfigured-safe: without SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
// isConfigured() is false and the files feature returns 501 (as in the original).
import { env } from './env.ts';

const UPLOAD_TTL_S = 300;
const DOWNLOAD_TTL_S = 300;
// Subject materials bucket (private). India/Tokyo buckets: attachments, avatars,
// exports, materials, notes. Override with SUPABASE_USER_BUCKET if needed.
const BUCKET = env('SUPABASE_USER_BUCKET') ?? 'materials';

function base(): string {
  return (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
}
function serviceKey(): string {
  return env('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

export function storageConfigured(): boolean {
  return Boolean(base() && serviceKey());
}

function headers() {
  const k = serviceKey();
  return { authorization: `Bearer ${k}`, apikey: k, 'content-type': 'application/json' };
}

export const storage = {
  isConfigured: storageConfigured,

  buildKey(userId: string, subjectId: string, fileId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/subjects/${subjectId}/${fileId}/${safe}`;
  },

  buildStagingKey(userId: string, uploadId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/staging/${uploadId}/${safe}`;
  },

  buildAdaAttachmentKey(userId: string, conversationId: string, fileId: string, name: string): string {
    const safe = name.replace(/[^\w.-]+/g, '_');
    return `quarantine/users/${userId}/ada/${conversationId}/${fileId}/${safe}`;
  },

  /** Signed upload URL the client PUTs to directly (Supabase signed upload token). */
  async presignUpload(key: string, _contentType: string): Promise<string> {
    const res = await fetch(`${base()}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ expiresIn: UPLOAD_TTL_S }),
    });
    if (!res.ok) throw new Error(`presignUpload failed (${res.status}): ${await res.text()}`);
    const json = await res.json() as { url?: string };
    if (!json.url) throw new Error('presignUpload: no url in response');
    return `${base()}/storage/v1${json.url}`;
  },

  /**
   * Read an object's bytes server-side, for Ada's file understanding.
   *
   * Distinct from presignDownload, which hands a URL to the client: here the
   * function itself needs the content to pass to the model. Callers MUST have
   * already established that `key` belongs to the requesting user — this does no
   * ownership check of its own and uses the service-role key, so a key built
   * from unvalidated input would read across tenants.
   *
   * `maxBytes` is enforced after the fetch: Storage has no ranged HEAD here, and
   * the point is to refuse to base64 a 200MB video into a prompt, not to save
   * the download.
   */
  async download(key: string, maxBytes: number): Promise<{ bytes: Uint8Array; mimeType: string }> {
    const k = serviceKey();
    const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${key}`, {
      headers: { authorization: `Bearer ${k}`, apikey: k },
    });
    if (!res.ok) throw new Error(`storage download failed (${res.status}): ${await res.text()}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new Error(`file is ${Math.round(buf.byteLength / 1024)}KB, over the ${Math.round(maxBytes / 1024)}KB limit`);
    }
    return {
      bytes: buf,
      mimeType: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  },

  /** Owner-only signed download; foreign ids are 404'd in the service layer. */
  async presignDownload(key: string): Promise<string> {
    const res = await fetch(`${base()}/storage/v1/object/sign/${BUCKET}/${key}`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ expiresIn: DOWNLOAD_TTL_S }),
    });
    if (!res.ok) throw new Error(`presignDownload failed (${res.status}): ${await res.text()}`);
    const json = await res.json() as { signedURL?: string };
    if (!json.signedURL) throw new Error('presignDownload: no signedURL in response');
    return `${base()}/storage/v1${json.signedURL}`;
  },
};
