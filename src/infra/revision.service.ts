import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * §4.6 — per-user monotonic revision counter + pub/sub fan-out. Every mutation
 * calls `bump`, which increments `sync:rev:{userId}` (the sync cursor) and
 * publishes to `revisions:{userId}` so the WS gateway can push an invalidation.
 */
@Injectable()
export class RevisionService {
  constructor(private readonly redis: RedisService) {}

  async bump(userId: string, entity?: string): Promise<number> {
    const revision = await this.redis.client.incr(this.key(userId));
    await this.redis.client.publish(
      this.channel(userId),
      JSON.stringify({ revision, entity: entity ?? null, at: new Date().toISOString() }),
    );
    return revision;
  }

  async current(userId: string): Promise<number> {
    const v = await this.redis.client.get(this.key(userId));
    return v ? Number(v) : 0;
  }

  channel(userId: string): string {
    return `revisions:${userId}`;
  }

  private key(userId: string): string {
    return `sync:rev:${userId}`;
  }
}
