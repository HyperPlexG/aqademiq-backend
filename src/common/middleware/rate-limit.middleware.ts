import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../infra/redis.service';

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 20; // /auth/* is stricter — 6-digit codes are brute-forceable (§2.1)
const GENERAL_LIMIT = 200;

/**
 * §2.1/§4.7 — Redis fixed-window rate limit per client IP. `/auth/*` gets a
 * tight budget; everything else a looser one. Fails open if Redis is briefly
 * unavailable (availability > strictness for a study app).
 *
 * TODO: layer per-account/email windows and Turnstile/App-Attest on auth.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const isAuth = (req.originalUrl || req.url).includes('/auth/');
    const limit = isAuth ? AUTH_LIMIT : GENERAL_LIMIT;
    const ip = this.clientIp(req);
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const key = `rl:${isAuth ? 'auth' : 'gen'}:${ip}:${window}`;

    try {
      const count = await this.redis.client.incr(key);
      if (count === 1) await this.redis.client.expire(key, WINDOW_SECONDS);
      if (count > limit) {
        const ttl = await this.redis.client.ttl(key);
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : WINDOW_SECONDS));
        return res.status(429).json({ statusCode: 429, message: 'Too many requests' });
      }
    } catch {
      // Redis hiccup → fail open rather than locking users out.
    }
    next();
  }

  private clientIp(req: Request): string {
    const fwd = req.headers['x-forwarded-for'];
    return (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()) || req.ip || 'unknown';
  }
}
