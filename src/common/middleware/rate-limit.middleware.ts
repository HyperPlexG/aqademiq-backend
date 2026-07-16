import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../infra/redis.service';

const WINDOW_SECONDS = 60;
const AUTH_LIMIT = 20; // /auth/* is stricter — 6-digit codes are brute-forceable (§2.1)
const GENERAL_LIMIT = 200;
const REDIS_OP_TIMEOUT_MS = 150;

/**
 * §2.1/§4.7 — Redis fixed-window rate limit per client IP. `/auth/*` gets a
 * tight budget; everything else a looser one. Fails open if Redis is briefly
 * unavailable (availability > strictness for a study app).
 *
 * IP trust: `X-Forwarded-For` is only honoured when `TRUST_PROXY=1` (i.e. we're
 * behind a known LB such as Cloud Run). Otherwise we key off the socket address
 * so a client can't spoof XFF to reset its window. Per-account/email windows are
 * layered on top in AuthService (issuance + verification budgets), so credential
 * and OTP brute force is bounded even if an attacker rotates source IPs.
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
      const count = await this.withTimeout(this.redis.client.incr(key));
      if (count === 1) await this.withTimeout(this.redis.client.expire(key, WINDOW_SECONDS));
      if (count > limit) {
        const ttl = await this.withTimeout(this.redis.client.ttl(key));
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : WINDOW_SECONDS));
        return res.status(429).json({ statusCode: 429, message: 'Too many requests' });
      }
    } catch {
      // Redis hiccup → fail open rather than locking users out.
    }
    next();
  }

  private clientIp(req: Request): string {
    // Only trust the client-supplied XFF when we know a trusted proxy sets it.
    if (process.env.TRUST_PROXY === '1') {
      const fwd = req.headers['x-forwarded-for'];
      const xff = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim());
      if (xff) return xff;
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), REDIS_OP_TIMEOUT_MS)),
    ]);
  }
}
