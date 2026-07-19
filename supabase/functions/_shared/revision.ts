// §4.6 — per-user monotonic revision counter + pub/sub. Port of src/infra/revision.service.ts.
// Backed by Upstash (INCR + PUBLISH). Fails open (no-op) when Redis is absent —
// the realtime fan-out is best-effort; the sync cursor degrades to 0.
import { env } from './env.ts';

const REST_URL = env('UPSTASH_REDIS_REST_URL');
const REST_TOKEN = env('UPSTASH_REDIS_REST_TOKEN');
const enabled = Boolean(REST_URL && REST_TOKEN);

async function cmd(args: (string | number)[]): Promise<unknown | null> {
  if (!enabled) return null;
  try {
    const res = await fetch(REST_URL!, {
      method: 'POST',
      headers: { authorization: `Bearer ${REST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    return (await res.json()).result ?? null;
  } catch {
    return null;
  }
}

const key = (userId: string) => `sync:rev:${userId}`;
export const revisionChannel = (userId: string) => `revisions:${userId}`;

export const revision = {
  async bump(userId: string, entity?: string): Promise<number> {
    const rev = await cmd(['INCR', key(userId)]);
    const revision = typeof rev === 'number' ? rev : 0;
    await cmd(['PUBLISH', revisionChannel(userId), JSON.stringify({ revision, entity: entity ?? null, at: new Date().toISOString() })]);
    return revision;
  },

  async current(userId: string): Promise<number> {
    const v = await cmd(['GET', key(userId)]);
    return typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : 0);
  },
};
