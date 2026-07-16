import * as crypto from 'node:crypto';

/**
 * Symmetric encryption for secrets at rest (e.g. third-party OAuth tokens on
 * `calendar_connections`). AES-256-GCM with a 32-byte key supplied via
 * `DATA_ENCRYPTION_KEY` (base64 or hex). Output format: `v1:<iv>:<tag>:<ct>`
 * (all base64url). Never log the plaintext.
 */
const PREFIX = 'v1';

function loadKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;
  let key: Buffer;
  try {
    key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  } catch {
    return null;
  }
  return key.length === 32 ? key : null;
}

export function isEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) throw new Error('DATA_ENCRYPTION_KEY is not configured (need a 32-byte base64/hex key)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  if (!key) throw new Error('DATA_ENCRYPTION_KEY is not configured');
  const [prefix, ivB64, tagB64, ctB64] = payload.split(':');
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !ctB64) throw new Error('Malformed ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
}
