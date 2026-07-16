import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { PrismaService } from '../../infra/prisma.service';
import { TokenService, type SessionInfo } from '../../infra/token.service';
import { RedisService } from '../../infra/redis.service';
import { EmailService } from '../../infra/email.service';
import {
  SignupDto,
  VerifyOtpDto,
  SigninDto,
  RefreshDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ForgotVerifyDto,
  ForgotResetDto,
  ChangePasswordDto,
  LinkGuestDto,
  SsoAppleDto,
  SsoGoogleDto,
  ChangeEmailRequestDto,
  ChangeEmailVerifyDto,
} from './dto/auth.dto';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL  = 'https://appleid.apple.com/auth/keys';

const OTP_TTL_MS            = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 24 * 1000;
const SIGNIN_MAX_FAILS       = 5;
const SIGNIN_LOCKOUT_SECONDS = 15 * 60;

// Per-email budgets, independent of source IP — bound OTP brute force / bombing
// even when an attacker rotates X-Forwarded-For (§2.1/§4.7 hardening).
const OTP_ISSUE_MAX_PER_HOUR   = 6;
const OTP_ISSUE_WINDOW_SECONDS = 60 * 60;
const OTP_VERIFY_MAX_PER_WINDOW = 10;
const OTP_VERIFY_WINDOW_SECONDS = 15 * 60;

function tooManyRequests(message: string): HttpException {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * Auth business logic. All flows operate on raw prisma (not tenant-scoped)
 * because there is no authenticated request context yet.
 *
 * Password hashes live on AuthIdentity (provider='email'), not on User.
 * OTPs live on EmailOtpCode keyed by email, not user_id.
 * Sessions live on UserSession with a status enum instead of revoked_at.
 */
@Injectable()
export class AuthService {
  // Lazily-fetched, cached JWKS for verifying platform-issued identity tokens.
  private readonly googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  private readonly appleJwks  = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}

  // ---- guest -------------------------------------------------------------

  async guest(info: SessionInfo = {}) {
    const user = await this.prisma.user.create({
      data: {
        is_guest:       true,
        auth_provider:  'guest',
        account_status: 'active',
        timezone:       'UTC',
      },
    });
    const tokens = await this.tokens.mintSession(user, info);
    return { ...tokens, user: this.publicUser(user) };
  }

  // ---- signup / OTP ------------------------------------------------------

  /**
   * Stage a pending signup. Creates the user + email AuthIdentity (unverified)
   * then issues a 6-digit OTP stored in email_otp_codes keyed by email.
   */
  async signup(dto: SignupDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);

    const existing = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email },
    });
    if (existing?.email_verified) {
      throw new ConflictException('An account with this email already exists');
    }

    const password_hash = await argon2.hash(dto.password, { type: argon2.argon2id });

    let userId: string;
    if (existing) {
      // Refresh the password on the existing (unverified) identity.
      await this.prisma.authIdentity.update({
        where: { id: existing.id },
        data:  { password_hash },
      });
      userId = existing.user_id;
    } else {
      // Create a fresh user + email identity.
      const user = await this.prisma.user.create({
        data: {
          email,
          is_guest:       false,
          auth_provider:  'email',
          account_status: 'active',
          timezone:       'UTC',
        },
      });
      await this.prisma.authIdentity.create({
        data: {
          user_id:          user.id,
          provider:         'email',
          provider_subject: email,
          email,
          email_verified:   false,
          password_hash,
        },
      });
      userId = user.id;
    }

    const devCode = await this.issueOtp(email, 'signup', info.ipAddress, info.userAgent);
    return {
      status:     'pending_verification',
      user_id:    userId,
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  /** Validate the 6-digit OTP → mark identity verified → mint the first token pair. */
  async verifyOtp(dto: VerifyOtpDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);
    await this.assertEmailBudget('otp_verify_signup', email, OTP_VERIFY_MAX_PER_WINDOW, OTP_VERIFY_WINDOW_SECONDS);

    const record = await this.findLatestOtp(email, 'signup');
    this.assertOtpValid(record, dto.code);

    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email },
    });
    if (!identity) throw new BadRequestException('Invalid or expired code');

    // Burn the OTP and flip the identity to verified.
    await this.prisma.emailOtpCode.update({
      where: { id: record.id },
      data:  { consumed_at: new Date() },
    });
    await this.prisma.authIdentity.update({
      where: { id: identity.id },
      data:  { email_verified: true },
    });
    // Promote the user out of guest state.
    const user = await this.prisma.user.update({
      where: { id: identity.user_id },
      data:  { is_guest: false, auth_provider: 'email' },
    });

    await this.recordAttempt(email, user.id, 'success', info, null);
    const tokens = await this.tokens.mintSession(user, info);
    return { ...tokens, user: this.publicUser(user) };
  }

  async resendOtp(dto: ResendOtpDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);
    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email },
    });
    // Never reveal whether email exists / is already verified.
    if (!identity || identity.email_verified) {
      return { status: 'sent', expires_in: Math.floor(OTP_TTL_MS / 1000) };
    }

    const last = await this.prisma.emailOtpCode.findFirst({
      where:   { email, purpose: 'signup', consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (last && Date.now() - last.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryIn = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - last.created_at.getTime())) / 1000,
      );
      throw new HttpException(
        `Please wait ${retryIn}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const devCode = await this.issueOtp(email, 'signup', info.ipAddress, info.userAgent);
    return {
      status:     'sent',
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  // ---- signin ------------------------------------------------------------

  async signin(dto: SigninDto, info: SessionInfo = {}) {
    const email   = this.normalizeEmail(dto.email);
    const lockKey = `auth:lockout:${email}`;
    const fails   = Number((await this.redis.client.get(lockKey)) ?? 0);
    if (fails >= SIGNIN_MAX_FAILS) {
      await this.recordAttempt(email, null, 'blocked', info, 'Rate limited');
      throw tooManyRequests('Too many failed attempts — try again later');
    }

    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email },
      include: { user: true },
    });

    const ok =
      identity?.password_hash && !identity.user.deleted_at
        ? await argon2.verify(identity.password_hash, dto.password)
        : await this.dummyVerify(dto.password);

    if (!identity || !ok) {
      await this.registerFailedSignin(lockKey);
      await this.recordAttempt(email, identity?.user_id ?? null, 'failed', info, 'Invalid credentials');
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!identity.email_verified) {
      throw new ForbiddenException('Email not verified');
    }
    if (identity.user.account_status !== 'active') {
      throw new ForbiddenException('Account is not active');
    }

    await this.redis.client.del(lockKey);
    const user = identity.user;
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { last_login_at: new Date() },
    });

    const tokens = await this.tokens.mintSession(user, info);
    await this.recordAttempt(email, user.id, 'success', info, null, tokens);
    return { ...tokens, user: this.publicUser(user) };
  }

  // ---- refresh -----------------------------------------------------------

  async refresh(dto: RefreshDto, info: SessionInfo = {}) {
    return this.tokens.rotate(dto.refresh_token, info);
  }

  // ---- password reset ----------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto, info: SessionInfo = {}) {
    const email    = this.normalizeEmail(dto.email);
    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email, email_verified: true },
      include: { user: true },
    });
    if (identity && !identity.user.deleted_at) {
      const code = await this.issueOtp(email, 'password_reset', info.ipAddress, info.userAgent);
      if (process.env.NODE_ENV !== 'production') return { status: 'sent', dev_code: code };
    }
    return { status: 'sent' };
  }

  async forgotVerify(dto: ForgotVerifyDto) {
    const email  = this.normalizeEmail(dto.email);
    await this.assertEmailBudget('otp_verify_reset', email, OTP_VERIFY_MAX_PER_WINDOW, OTP_VERIFY_WINDOW_SECONDS);
    const record = await this.findLatestOtp(email, 'password_reset');
    this.assertOtpValid(record, dto.code);
    return { valid: true };
  }

  async forgotReset(dto: ForgotResetDto) {
    const email    = this.normalizeEmail(dto.email);
    await this.assertEmailBudget('otp_verify_reset', email, OTP_VERIFY_MAX_PER_WINDOW, OTP_VERIFY_WINDOW_SECONDS);
    const record   = await this.findLatestOtp(email, 'password_reset');
    this.assertOtpValid(record, dto.code);

    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email },
    });
    if (!identity) throw new BadRequestException('Invalid or expired code');

    const password_hash = await argon2.hash(dto.new_password, { type: argon2.argon2id });
    await this.prisma.authIdentity.update({ where: { id: identity.id }, data: { password_hash } });
    await this.prisma.emailOtpCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    await this.tokens.revokeAllForUser(identity.user_id);
    return { status: 'reset' };
  }

  // ---- authenticated flows -----------------------------------------------

  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto) {
    const identity = await this.prisma.authIdentity.findFirst({
      where: { user_id: userId, provider: 'email' },
    });
    if (!identity?.password_hash) throw new UnauthorizedException();
    if (!(await argon2.verify(identity.password_hash, dto.old_password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const password_hash = await argon2.hash(dto.new_password, { type: argon2.argon2id });
    await this.prisma.authIdentity.update({ where: { id: identity.id }, data: { password_hash } });
    await this.tokens.revokeAllForUser(userId, currentSessionId);
    return { status: 'changed' };
  }

  /**
   * In-place promotion of a guest to a registered account. Attaches email +
   * creates an AuthIdentity; verify-otp then flips email_verified so all
   * guest-owned data is preserved under the same user id.
   */
  async linkGuest(userId: string, dto: LinkGuestDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);
    const user  = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)          throw new UnauthorizedException();
    if (!user.is_guest) throw new ConflictException('Account is already registered');

    const taken = await this.prisma.authIdentity.findFirst({ where: { provider: 'email', email } });
    if (taken && taken.user_id !== userId) {
      throw new ConflictException('An account with this email already exists');
    }

    const password_hash = await argon2.hash(dto.password, { type: argon2.argon2id });
    if (taken) {
      await this.prisma.authIdentity.update({ where: { id: taken.id }, data: { password_hash } });
    } else {
      await this.prisma.authIdentity.create({
        data: {
          user_id:          userId,
          provider:         'email',
          provider_subject: email,
          email,
          email_verified:   false,
          password_hash,
        },
      });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { email } });

    const devCode = await this.issueOtp(email, 'signup', info.ipAddress, info.userAgent);
    return {
      status:     'pending_verification',
      user_id:    userId,
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  async signout(sessionId: string) {
    await this.tokens.signOutSession(sessionId);
    return { status: 'signed_out' };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.userSession.findMany({
      where:   { user_id: userId, status: 'active' },
      orderBy: { login_at: 'desc' },
    });
    return {
      sessions: rows.map((s) => ({
        id:         s.id,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
        login_at:   s.login_at,
        current:    s.id === currentSessionId,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId) throw new NotFoundException('Session not found');
    await this.tokens.revokeSession(sessionId);
    return { status: 'revoked' };
  }

  async revokeAll(userId: string) {
    await this.tokens.revokeAllForUser(userId);
    return { status: 'revoked_all' };
  }

  async deleteAccount(userId: string) {
    const graceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data:  { deleted_at: new Date(), account_status: 'deleted' },
    });
    await this.tokens.revokeAllForUser(userId);
    return { status: 'scheduled_for_deletion', grace_until: graceUntil.toISOString() };
  }

  // ---- OAuth sign-in (Apple / Google) ------------------------------------

  /**
   * §2.1/§4.1 — verify the platform-issued identity token against the
   * provider's live JWKS (no client secret needed for id-token verification),
   * then find-or-create the user. Mirrors the email signup/signin shape:
   * returns a fresh token pair either way.
   */
  async ssoGoogle(dto: SsoGoogleDto, info: SessionInfo = {}) {
    const allowedAud = this.splitEnv('GOOGLE_OAUTH_CLIENT_IDS');
    if (!allowedAud.length) {
      throw new UnprocessableEntityException('Google sign-in is not configured (set GOOGLE_OAUTH_CLIENT_IDS)');
    }
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(dto.id_token, this.googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: allowedAud,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired Google identity token');
    }
    return this.ssoFindOrCreate('google', payload, info);
  }

  async ssoApple(dto: SsoAppleDto, info: SessionInfo = {}) {
    const allowedAud = this.splitEnv('APPLE_OAUTH_CLIENT_IDS');
    if (!allowedAud.length) {
      throw new UnprocessableEntityException('Apple sign-in is not configured (set APPLE_OAUTH_CLIENT_IDS)');
    }
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(dto.identity_token, this.appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: allowedAud,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired Apple identity token');
    }
    return this.ssoFindOrCreate('apple', payload, info, dto.full_name);
  }

  /**
   * Shared find-or-create for both OAuth providers: match on
   * (provider, provider_subject) first; if this is the first time we've seen
   * this provider identity but the token's email matches an existing
   * *verified* email/password account, link the two instead of duplicating
   * the user. Otherwise create a brand-new user + auth_identities row.
   */
  private async ssoFindOrCreate(
    provider: 'google' | 'apple',
    payload: JWTPayload,
    info: SessionInfo,
    fullName?: string,
  ) {
    const subject = String(payload.sub);
    const rawEmail = typeof payload.email === 'string' ? payload.email : null;
    const email = rawEmail ? this.normalizeEmail(rawEmail) : null;
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

    let identity = await this.prisma.authIdentity.findFirst({ where: { provider, provider_subject: subject } });
    let user;

    if (identity) {
      user = await this.prisma.user.findUnique({ where: { id: identity.user_id } });
      if (!user || user.deleted_at) throw new UnauthorizedException('Account unavailable');
    } else {
      const existingByEmail = email
        ? await this.prisma.authIdentity.findFirst({ where: { provider: 'email', email, email_verified: true } })
        : null;

      if (existingByEmail) {
        user = await this.prisma.user.findUnique({ where: { id: existingByEmail.user_id } });
        if (!user || user.deleted_at) throw new UnauthorizedException('Account unavailable');
        identity = await this.prisma.authIdentity.create({
          data: { user_id: user.id, provider, provider_subject: subject, email, email_verified: emailVerified },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: email ?? undefined,
            full_name: fullName ?? undefined,
            is_guest: false,
            auth_provider: provider,
            account_status: 'active',
            timezone: 'UTC',
          },
        });
        identity = await this.prisma.authIdentity.create({
          data: { user_id: user.id, provider, provider_subject: subject, email, email_verified: emailVerified },
        });
      }
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    const tokens = await this.tokens.mintSession(user, info);
    await this.recordAttempt(email ?? `${provider}:${subject}`, user.id, 'success', info, null, tokens);
    return { ...tokens, user: this.publicUser(user) };
  }

  // ---- email change --------------------------------------------------------

  /**
   * Step 1/2 of changing a verified email: issue an OTP addressed to the
   * *new* email (never the old one, so a hijacked inbox on the old address
   * can't block the change). Mirrors `forgotPassword`'s shape.
   */
  async changeEmailRequest(userId: string, dto: ChangeEmailRequestDto, info: SessionInfo = {}) {
    const newEmail = this.normalizeEmail(dto.new_email);
    const taken = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email: newEmail, email_verified: true },
    });
    if (taken && taken.user_id !== userId) {
      throw new ConflictException('An account with this email already exists');
    }
    const devCode = await this.issueOtp(newEmail, 'change_email', info.ipAddress, info.userAgent);
    return {
      status: 'sent',
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  /** Step 2/2: confirm the OTP sent to the new email, then repoint User.email
   *  and the matching email AuthIdentity to it. */
  async changeEmailVerify(userId: string, dto: ChangeEmailVerifyDto) {
    const newEmail = this.normalizeEmail(dto.new_email);
    await this.assertEmailBudget('otp_verify_change_email', newEmail, OTP_VERIFY_MAX_PER_WINDOW, OTP_VERIFY_WINDOW_SECONDS);
    const record = await this.findLatestOtp(newEmail, 'change_email');
    this.assertOtpValid(record, dto.code);

    const identity = await this.prisma.authIdentity.findFirst({ where: { user_id: userId, provider: 'email' } });
    if (!identity) throw new BadRequestException('No email/password identity on this account to update');

    // Re-check for a collision at verify time too (email could've been taken
    // by someone else between request and verify).
    const taken = await this.prisma.authIdentity.findFirst({
      where: { provider: 'email', email: newEmail, email_verified: true },
    });
    if (taken && taken.user_id !== userId) {
      throw new ConflictException('An account with this email already exists');
    }

    await this.prisma.emailOtpCode.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    await this.prisma.authIdentity.update({
      where: { id: identity.id },
      data: { email: newEmail, provider_subject: newEmail, email_verified: true },
    });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
    return { status: 'changed', email: user.email };
  }

  // ---- private helpers ---------------------------------------------------

  private async issueOtp(
    email: string,
    purpose: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<string> {
    // Bound issuance per email (anti-bombing), independent of source IP.
    await this.assertEmailBudget('otp_issue', email, OTP_ISSUE_MAX_PER_HOUR, OTP_ISSUE_WINDOW_SECONDS);

    // Invalidate any previous unconsumed OTPs for this email+purpose.
    await this.prisma.emailOtpCode.updateMany({
      where: { email, purpose, consumed_at: null },
      data:  { consumed_at: new Date() },
    });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.emailOtpCode.create({
      data: {
        email,
        purpose,
        otp_hash:   this.hashCode(code),
        expires_at: new Date(Date.now() + OTP_TTL_MS),
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null,
      },
    });

    // Best-effort delivery via Resend. Never throws; when the provider is not
    // configured this is a no-op and dev relies on the console log / dev_code.
    await this.email.sendOtp(email, purpose, code);

    // Only log the plaintext code outside production to avoid leaking it in logs.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[auth] OTP (${purpose}) for ${email}: ${code}`);
    }
    return code;
  }

  private async findLatestOtp(email: string, purpose: string) {
    const record = await this.prisma.emailOtpCode.findFirst({
      where:   { email, purpose, consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    return record;
  }

  private assertOtpValid(
    record: { id: string; expires_at: Date; attempts_count: number; max_attempts: number; otp_hash: string } | null,
    code: string,
  ): asserts record is { id: string; expires_at: Date; attempts_count: number; max_attempts: number; otp_hash: string } {
    if (!record || record.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.attempts_count >= record.max_attempts) {
      throw tooManyRequests('Too many attempts — request a new code');
    }
    if (this.hashCode(code) !== record.otp_hash) {
      // Increment attempt count and throw.
      void this.prisma.emailOtpCode.update({
        where: { id: record.id },
        data:  { attempts_count: { increment: 1 } },
      }).catch(() => { /* best-effort */ });
      throw new BadRequestException('Invalid or expired code');
    }
  }

  private async recordAttempt(
    email: string,
    userId: string | null,
    status: 'success' | 'failed' | 'blocked',
    info: SessionInfo,
    failureReason: string | null,
    tokens?: { access_token: string },
  ) {
    // Extract session id from the access token to link the attempt to a session.
    let createdSessionId: string | null = null;
    if (tokens?.access_token) {
      try {
        const claims = await this.tokens.verifyAccess(tokens.access_token);
        createdSessionId = claims.sid;
      } catch { /* non-critical */ }
    }
    await this.prisma.loginAttempt.create({
      data: {
        email_entered:      email,
        user_id:            userId,
        status,
        failure_reason:     failureReason,
        ip_address:         info.ipAddress ?? 'unknown',
        user_agent:         info.userAgent ?? null,
        created_session_id: createdSessionId,
      },
    });
  }

  private async registerFailedSignin(lockKey: string): Promise<void> {
    const n = await this.redis.client.incr(lockKey);
    if (n === 1) await this.redis.client.expire(lockKey, SIGNIN_LOCKOUT_SECONDS);
  }

  /**
   * Fixed-window per-email budget in Redis. Throws 429 once `limit` is exceeded
   * inside `windowSeconds`. Fails open on a Redis hiccup (availability first).
   */
  private async assertEmailBudget(kind: string, email: string, limit: number, windowSeconds: number): Promise<void> {
    const key = `auth:budget:${kind}:${email}`;
    try {
      const n = await this.redis.client.incr(key);
      if (n === 1) await this.redis.client.expire(key, windowSeconds);
      if (n > limit) throw tooManyRequests('Too many attempts for this email — try again later');
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Redis unavailable → don't lock the user out.
    }
  }

  private async dummyVerify(password: string): Promise<boolean> {
    const dummy =
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$' +
      'RdescudvJCsgt3ub+b+dWRWJTmaaJObG';
    try { await argon2.verify(dummy, password); } catch { /* expected */ }
    return false;
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private splitEnv(name: string): string[] {
    return (process.env[name] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  private publicUser(u: { id: string; email: string | null; is_guest: boolean }) {
    return { id: u.id, email: u.email, is_guest: u.is_guest };
  }
}
