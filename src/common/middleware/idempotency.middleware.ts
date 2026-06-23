import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'node:crypto';
import { RedisService } from '../../infra/redis.service';

const IDEM_TTL_SECONDS = 24 * 60 * 60; // §4.6: persist 24–48h
const MUTATING = ['POST', 'PATCH', 'PUT', 'DELETE'];

/**
 * §4.6: Idempotency-Key replay guard. On a mutating request carrying the header,
 * a hit replays the stored response; a miss runs the handler and caches the
 * successful (2xx) result. Scoped by a hash of the bearer token so keys can't
 * cross users. Runs as middleware (before the guard), hence token-hash scoping
 * rather than userId.
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = req.header('Idempotency-Key');
    if (!key || !MUTATING.includes(req.method)) return next();

    const auth = req.header('authorization') ?? 'anon';
    const scope = crypto.createHash('sha256').update(`${auth}:${key}`).digest('hex').slice(0, 32);
    const redisKey = `idem:${scope}`;

    const cached = await this.redis.client.get(redisKey).catch(() => null);
    if (cached) {
      const { status, body } = JSON.parse(cached);
      res.setHeader('Idempotent-Replay', 'true');
      return res.status(status).json(body);
    }

    // Capture the first successful response and cache it for replay.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        this.redis.client
          .set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', IDEM_TTL_SECONDS, 'NX')
          .catch(() => undefined);
      }
      return originalJson(body);
    };
    next();
  }
}
