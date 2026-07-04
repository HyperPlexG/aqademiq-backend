import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike, type JWTPayload } from 'jose';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

const ALG = 'RS256';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface AccessClaims {
  sub: string;       // user id
  sid: string;       // user_session id
  is_guest: boolean;
}

export interface SessionInfo {
  deviceInfo?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Token engine. Access tokens are short-lived RS256 JWTs carrying the session
 * id (sid). Refresh tokens are opaque {sid}.{secret} strings whose secret is
 * stored hashed in user_sessions. Revocation is instant via a Redis deny-list
 * keyed by sid. Sessions now use a status field (active/revoked/logged_out)
 * instead of revoked_at.
 */
@Injectable()
export class TokenService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;
  private readonly accessTtlSeconds = Number(process.env.ACCESS_TTL_SECONDS ?? 900);
  private readonly refreshTtlDays = Number(process.env.REFRESH_TTL_DAYS ?? 60);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    const privPath = process.env.JWT_PRIVATE_KEY_PATH ?? './keys/jwt_private.pem';
    const pubPath  = process.env.JWT_PUBLIC_KEY_PATH  ?? './keys/jwt_public.pem';
    this.privateKey = await importPKCS8(fs.readFileSync(privPath, 'utf8'), ALG);
    this.publicKey  = await importSPKI(fs.readFileSync(pubPath,  'utf8'), ALG);
  }

  // ---- minting -----------------------------------------------------------

  /** Mint a fresh access+refresh pair for a new session (login / OTP confirm). */
  async mintSession(
    user: { id: string; is_guest: boolean },
    info: SessionInfo = {},
  ): Promise<TokenPair> {
    return this.issueSession(user, info);
  }

  /**
   * Rotate a refresh token. If the presented session is already revoked,
   * all sessions for that user are killed (reuse = possible theft).
   * Otherwise the old session is revoked and a new one is issued.
   */
  async rotate(refreshToken: string, info: SessionInfo = {}): Promise<TokenPair> {
    const parsed = this.parseRefresh(refreshToken);
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');
    const { sid, secret } = parsed;

    const session = await this.prisma.userSession.findUnique({ where: { id: sid } });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    // Reuse detection: revoked session presented again → possible theft.
    if (session.status !== 'active') {
      await this.revokeAllForUser(session.user_id);
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    const presentedHash = this.hashSecret(secret);
    const stored = session.refresh_token_hash ?? '';
    if (
      presentedHash.length !== stored.length ||
      !crypto.timingSafeEqual(Buffer.from(presentedHash), Buffer.from(stored))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.user_id } });
    if (!user || user.deleted_at) throw new UnauthorizedException('Account unavailable');

    await this.revokeSession(session.id);
    return this.issueSession(user, {
      deviceInfo: info.deviceInfo ?? null,
      ipAddress:  info.ipAddress  ?? session.ip_address,
      userAgent:  info.userAgent  ?? session.user_agent,
    });
  }

  // ---- verification (used by the guard) ----------------------------------

  async verifyAccess(token: string): Promise<AccessClaims> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.publicKey, { algorithms: [ALG] }));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    const sid = payload.sid as string | undefined;
    if (!payload.sub || !sid) throw new UnauthorizedException('Invalid token');

    if (await this.redis.client.exists(this.denyKey(sid))) {
      throw new UnauthorizedException('Session revoked');
    }
    return { sub: payload.sub, sid, is_guest: Boolean(payload.is_guest) };
  }

  // ---- revocation --------------------------------------------------------

  async revokeSession(sid: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sid, status: 'active' },
      data:  { status: 'revoked' },
    });
    await this.redis.client.set(this.denyKey(sid), '1', 'EX', this.accessTtlSeconds);
  }

  async signOutSession(sid: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sid, status: 'active' },
      data:  { status: 'logged_out', logged_out_at: new Date() },
    });
    await this.redis.client.set(this.denyKey(sid), '1', 'EX', this.accessTtlSeconds);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const where: Record<string, unknown> = { user_id: userId, status: 'active' };
    if (exceptSessionId) where.id = { not: exceptSessionId };
    await this.revokeWhere(where);
  }

  // ---- internals ---------------------------------------------------------

  private async issueSession(
    user: { id: string; is_guest: boolean },
    info: SessionInfo,
  ): Promise<TokenPair> {
    const secret    = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 86_400_000);

    // Allocate the session row so we have the id for the JWT sid claim.
    const session = await this.prisma.userSession.create({
      data: {
        user_id:            user.id,
        session_token_hash: '',          // filled in below after we know the id
        refresh_token_hash: this.hashSecret(secret),
        ip_address:         info.ipAddress  ?? '127.0.0.1',
        user_agent:         info.userAgent  ?? null,
        status:             'active',
        login_at:           new Date(),
        last_active_at:     new Date(),
        expires_at:         expiresAt,
      },
    });

    // Store a hash of the session id as the session_token_hash.
    const sessionTokenHash = this.hashSecret(session.id);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data:  { session_token_hash: sessionTokenHash },
    });

    const access_token = await this.signAccess(user, session.id);
    return {
      access_token,
      refresh_token: `${session.id}.${secret}`,
      token_type:    'Bearer',
      expires_in:    this.accessTtlSeconds,
    };
  }

  private async revokeWhere(where: Record<string, unknown>): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({
      where: where as any,
      select: { id: true },
    });
    await this.prisma.userSession.updateMany({
      where: where as any,
      data:  { status: 'revoked' },
    });
    if (sessions.length) {
      const pipe = this.redis.client.pipeline();
      for (const s of sessions) {
        pipe.set(this.denyKey(s.id), '1', 'EX', this.accessTtlSeconds);
      }
      await pipe.exec();
    }
  }

  private async signAccess(user: { id: string; is_guest: boolean }, sid: string): Promise<string> {
    return new SignJWT({ sid, is_guest: user.is_guest })
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setSubject(user.id)
      .setIssuedAt()
      .setIssuer('aqademiq')
      .setAudience('aqademiq-app')
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.privateKey);
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private parseRefresh(token: string): { sid: string; secret: string } | null {
    const idx = token.indexOf('.');
    if (idx <= 0 || idx === token.length - 1) return null;
    return { sid: token.slice(0, idx), secret: token.slice(idx + 1) };
  }

  private denyKey(sid: string): string {
    return `auth:deny:${sid}`;
  }
}
