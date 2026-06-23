import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike, type JWTPayload } from 'jose';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

const ALG = 'RS256';

/** Issued token bundle returned to the client. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

/** Verified access-token claims attached to the request by the guard. */
export interface AccessClaims {
  sub: string; // user id
  sid: string; // auth_session id
  is_guest: boolean;
}

export interface SessionInfo {
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

/**
 * §4.1 token engine. Access tokens are short-lived RS256 JWTs carrying the
 * session id (`sid`); refresh tokens are opaque `{sid}.{secret}` strings whose
 * secret is only ever stored hashed (SHA-256) in `auth_sessions`. Revocation is
 * instant via a Redis deny-list keyed by `sid`. Rotation creates a new session
 * row in the same `family_id`; presenting an already-rotated (revoked) refresh
 * token is treated as theft and revokes the whole family.
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
    const pubPath = process.env.JWT_PUBLIC_KEY_PATH ?? './keys/jwt_public.pem';
    this.privateKey = await importPKCS8(fs.readFileSync(privPath, 'utf8'), ALG);
    this.publicKey = await importSPKI(fs.readFileSync(pubPath, 'utf8'), ALG);
  }

  // ---- minting -----------------------------------------------------------

  /** Mint a fresh access+refresh pair for a brand-new session (login / OTP confirm). */
  async mintSession(
    user: { id: string; is_guest: boolean },
    info: SessionInfo = {},
  ): Promise<TokenPair> {
    const familyId = crypto.randomUUID();
    return this.issueInFamily(user, familyId, info);
  }

  /**
   * Rotate a refresh token. Detects reuse: if the presented session is already
   * revoked, the entire family is killed (§4.1). Otherwise the old session is
   * revoked and a new one is issued in the same family.
   */
  async rotate(refreshToken: string, info: SessionInfo = {}): Promise<TokenPair> {
    const parsed = this.parseRefresh(refreshToken);
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');
    const { sid, secret } = parsed;

    const session = await this.prisma.authSession.findUnique({ where: { id: sid } });
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    // Reuse detection: a revoked session presented again ⇒ token theft.
    if (session.revoked_at) {
      await this.revokeFamily(session.family_id);
      throw new UnauthorizedException('Refresh token reuse detected — session revoked');
    }

    // Constant-time compare of the presented secret against the stored hash.
    const presentedHash = this.hashSecret(secret);
    const stored = session.refresh_token_hash;
    if (
      presentedHash.length !== stored.length ||
      !crypto.timingSafeEqual(Buffer.from(presentedHash), Buffer.from(stored))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.user_id } });
    if (!user || user.deleted_at) throw new UnauthorizedException('Account unavailable');

    // Revoke the old session (and deny-list its access tokens), issue a new one
    // in the same family.
    await this.revokeSession(session.id);
    return this.issueInFamily(user, session.family_id, {
      deviceInfo: info.deviceInfo ?? session.device_info,
      ipAddress: info.ipAddress ?? session.ip_address,
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

    // Instant revocation: deny-listed session ids fail even if the JWT is valid.
    if (await this.redis.client.exists(this.denyKey(sid))) {
      throw new UnauthorizedException('Session revoked');
    }
    return { sub: payload.sub, sid, is_guest: Boolean(payload.is_guest) };
  }

  // ---- revocation --------------------------------------------------------

  /** Revoke a single session and deny-list its still-valid access tokens. */
  async revokeSession(sid: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sid, revoked_at: null },
      data: { revoked_at: new Date() },
    });
    await this.redis.client.set(this.denyKey(sid), '1', 'EX', this.accessTtlSeconds);
  }

  /** Revoke every session sharing a family (reuse detection / password reset). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeWhere({ family_id: familyId, revoked_at: null });
  }

  /**
   * Revoke every active session for a user (forgot-password reset / sign out
   * everywhere). Pass `exceptSessionId` to keep the caller's current session
   * alive (change-password "revoke others").
   */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const where: { user_id: string; revoked_at: null; id?: { not: string } } = {
      user_id: userId,
      revoked_at: null,
    };
    if (exceptSessionId) where.id = { not: exceptSessionId };
    await this.revokeWhere(where);
  }

  private async revokeWhere(where: Record<string, unknown>): Promise<void> {
    const sessions = await this.prisma.authSession.findMany({
      where: where as any,
      select: { id: true },
    });
    await this.prisma.authSession.updateMany({
      where: where as any,
      data: { revoked_at: new Date() },
    });
    if (sessions.length) {
      const pipe = this.redis.client.pipeline();
      for (const s of sessions) pipe.set(this.denyKey(s.id), '1', 'EX', this.accessTtlSeconds);
      await pipe.exec();
    }
  }

  // ---- internals ---------------------------------------------------------

  private async issueInFamily(
    user: { id: string; is_guest: boolean },
    familyId: string,
    info: SessionInfo,
  ): Promise<TokenPair> {
    const secret = crypto.randomBytes(32).toString('base64url');
    const session = await this.prisma.authSession.create({
      data: {
        user_id: user.id,
        refresh_token_hash: this.hashSecret(secret),
        family_id: familyId,
        device_info: info.deviceInfo ?? null,
        ip_address: info.ipAddress ?? null,
      },
    });
    const access_token = await this.signAccess(user, session.id);
    return {
      access_token,
      refresh_token: `${session.id}.${secret}`,
      token_type: 'Bearer',
      expires_in: this.accessTtlSeconds,
    };
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
