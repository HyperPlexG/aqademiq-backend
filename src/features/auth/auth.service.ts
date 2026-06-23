import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { TokenService, type SessionInfo } from '../../infra/token.service';
import { RedisService } from '../../infra/redis.service';
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
} from './dto/auth.dto';

const OTP_TTL_MS = 10 * 60 * 1000; // §2.1 codes are short-lived
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 24 * 1000; // §2.1 resend cooldown (24s in UI)
const RESET_TTL_MS = 15 * 60 * 1000;
const SIGNIN_MAX_FAILS = 5;
const SIGNIN_LOCKOUT_SECONDS = 15 * 60;

function tooManyRequests(message: string): HttpException {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

/** §2.1/§4.1 — auth business logic. Auth flows touch the User/session tables
 *  directly (raw `prisma.*`), NOT the tenant-scoped extension, because there is
 *  no authenticated user yet when these run. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
  ) {}

  /**
   * §4.1: a guest is a real, server-backed anonymous user (`is_guest=true`,
   * `email=null`). The app boots straight into a guest session, so we mint
   * tokens immediately.
   */
  async guest(info: SessionInfo = {}) {
    const user = await this.prisma.user.create({
      data: { is_guest: true, email_verified: false },
    });
    const tokens = await this.tokens.mintSession(user, info);
    return { ...tokens, user: this.publicUser(user) };
  }

  /**
   * §2.1/§4.1: collect email + password and stage a pending verification.
   * NO tokens are minted here — only at OTP confirm. Creates (or refreshes) an
   * unverified user row and issues a 6-digit code.
   */
  async signup(dto: SignupDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.email_verified) {
      throw new ConflictException('An account with this email already exists');
    }

    const password_hash = await argon2.hash(dto.password, { type: argon2.argon2id });

    // Reuse the pending row if the user restarted signup; otherwise create one.
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { password_hash, is_guest: false },
        })
      : await this.prisma.user.create({
          data: { email, password_hash, is_guest: false, email_verified: false },
        });

    const devCode = await this.issueOtp(user.id);

    return {
      status: 'pending_verification',
      user_id: user.id,
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      // Dev affordance: no email provider is wired locally, so surface the code
      // outside production to make the flow testable. Never leaks in prod.
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  /** §2.1/§4.1: validate the 6-digit code → mark verified → mint the first token pair. */
  async verifyOtp(dto: VerifyOtpDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { user_id: user.id, type: 'signup' },
      orderBy: { created_at: 'desc' },
    });
    if (!record || record.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.attempt_count >= OTP_MAX_ATTEMPTS) {
      throw tooManyRequests('Too many attempts — request a new code');
    }

    const matches = this.hashCode(dto.code) === record.code_hash;
    if (!matches) {
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempt_count: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    // Success: flip verified + promote out of guest (covers link-guest), burn
    // all outstanding signup codes, mint tokens.
    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { email_verified: true, is_guest: false },
    });
    await this.prisma.emailVerificationCode.deleteMany({
      where: { user_id: user.id, type: 'signup' },
    });

    const tokens = await this.tokens.mintSession(verified, info);
    return { ...tokens, user: this.publicUser(verified) };
  }

  /** §2.1/§4.1: argon2id verify with Redis-backed lockout counters. */
  async signin(dto: SigninDto, info: SessionInfo = {}) {
    const email = this.normalizeEmail(dto.email);
    const lockKey = `auth:lockout:${email}`;
    const fails = Number((await this.redis.client.get(lockKey)) ?? 0);
    if (fails >= SIGNIN_MAX_FAILS) {
      throw tooManyRequests('Too many failed attempts — try again later');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Verify against the stored hash (or a dummy to keep timing constant and
    // avoid leaking whether the email exists).
    const ok =
      user?.password_hash && !user.deleted_at
        ? await argon2.verify(user.password_hash, dto.password)
        : await this.dummyVerify(dto.password);

    if (!user || !ok) {
      await this.registerFailedSignin(lockKey);
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.email_verified) {
      throw new ForbiddenException('Email not verified');
    }

    await this.redis.client.del(lockKey);
    const tokens = await this.tokens.mintSession(user, info);
    return { ...tokens, user: this.publicUser(user) };
  }

  /** §2.1/§4.1: rotate the refresh token; reuse-detection revokes the family. */
  async refresh(dto: RefreshDto, info: SessionInfo = {}) {
    return this.tokens.rotate(dto.refresh_token, info);
  }

  // ---- helpers -----------------------------------------------------------

  private async issueOtp(userId: string): Promise<string> {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.emailVerificationCode.create({
      data: {
        user_id: userId,
        code_hash: this.hashCode(code),
        type: 'signup',
        expires_at: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    // TODO(§7): hand off to the transactional email queue. Logged for now.
    // eslint-disable-next-line no-console
    console.log(`[auth] signup OTP for user ${userId}: ${code}`);
    return code;
  }

  private async registerFailedSignin(lockKey: string): Promise<void> {
    const n = await this.redis.client.incr(lockKey);
    if (n === 1) await this.redis.client.expire(lockKey, SIGNIN_LOCKOUT_SECONDS);
  }

  private async dummyVerify(password: string): Promise<boolean> {
    // Constant-ish work against a fixed hash so non-existent emails don't return
    // faster than wrong passwords (user enumeration defence).
    const dummy =
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$' +
      'RdescudvJCsgt3ub+b+dWRWJTmaaJObG';
    try {
      await argon2.verify(dummy, password);
    } catch {
      /* expected */
    }
    return false;
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private publicUser(u: { id: string; email: string | null; is_guest: boolean; email_verified: boolean }) {
    return { id: u.id, email: u.email, is_guest: u.is_guest, email_verified: u.email_verified };
  }

  /** §2.1: re-issue a signup OTP, enforcing the 24s resend cooldown. */
  async resendOtp(dto: ResendOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Never reveal whether the email exists / is already verified.
    if (!user || user.email_verified) {
      return { status: 'sent', expires_in: Math.floor(OTP_TTL_MS / 1000) };
    }

    const last = await this.prisma.emailVerificationCode.findFirst({
      where: { user_id: user.id, type: 'signup' },
      orderBy: { created_at: 'desc' },
    });
    if (last && Date.now() - last.created_at.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryIn = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - last.created_at.getTime())) / 1000);
      throw new HttpException(`Please wait ${retryIn}s before requesting another code`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const devCode = await this.issueOtp(user.id);
    return {
      status: 'sent',
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  /** §2.1: phase 1 of password reset — issue a 6-digit reset code. Always 200
   *  (no account-existence disclosure). */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deleted_at && user.password_hash) {
      const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      await this.prisma.passwordResetToken.create({
        data: {
          user_id: user.id,
          reset_code_hash: this.hashCode(code),
          expires_at: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      // TODO(§7): send via transactional email queue.
      // eslint-disable-next-line no-console
      console.log(`[auth] password reset code for ${email}: ${code}`);
      if (process.env.NODE_ENV !== 'production') {
        return { status: 'sent', dev_code: code };
      }
    }
    return { status: 'sent' };
  }

  /** §2.1: phase 2 — check the reset code is valid without consuming it. */
  async forgotVerify(dto: ForgotVerifyDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const token = user && (await this.latestValidResetToken(user.id));
    if (!token || token.reset_code_hash !== this.hashCode(dto.code)) {
      throw new BadRequestException('Invalid or expired code');
    }
    return { valid: true };
  }

  /** §2.1/§4.1: phase 3 — set new password, burn reset tokens, REVOKE ALL sessions. */
  async forgotReset(dto: ForgotResetDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const token = user && (await this.latestValidResetToken(user.id));
    if (!user || !token || token.reset_code_hash !== this.hashCode(dto.code)) {
      throw new BadRequestException('Invalid or expired code');
    }

    const password_hash = await argon2.hash(dto.new_password, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: user.id }, data: { password_hash } });
    await this.prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } });
    await this.tokens.revokeAllForUser(user.id); // §4.1: reset kills every session

    return { status: 'reset' };
  }

  /** §2.1: authenticated password change. Verifies the old password, then
   *  revokes every OTHER session (keeps the caller signed in). */
  async changePassword(userId: string, currentSessionId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password_hash) throw new UnauthorizedException();
    if (!(await argon2.verify(user.password_hash, dto.old_password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const password_hash = await argon2.hash(dto.new_password, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash } });
    await this.tokens.revokeAllForUser(userId, currentSessionId);
    return { status: 'changed' };
  }

  /** §2.1/§4.1: in-place promotion of the current guest user. Attaches email +
   *  password to the SAME user.id and issues a signup OTP — verify-otp then flips
   *  email_verified + is_guest=false, so all guest-owned rows are preserved. */
  async linkGuest(userId: string, dto: LinkGuestDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.is_guest) throw new ConflictException('Account is already registered');

    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== userId) {
      throw new ConflictException('An account with this email already exists');
    }

    const password_hash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { email, password_hash } });
    const devCode = await this.issueOtp(userId);

    return {
      status: 'pending_verification',
      user_id: userId,
      expires_in: Math.floor(OTP_TTL_MS / 1000),
      ...(process.env.NODE_ENV !== 'production' ? { dev_code: devCode } : {}),
    };
  }

  /** §2.1/§4.1: revoke the caller's current session (deny-list its access token). */
  async signout(sessionId: string) {
    await this.tokens.revokeSession(sessionId);
    return { status: 'signed_out' };
  }

  /** §2.1: list the caller's active sessions (multi-device), flagging the current one. */
  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.authSession.findMany({
      where: { user_id: userId, revoked_at: null },
      orderBy: { created_at: 'desc' },
    });
    return {
      sessions: rows.map((s) => ({
        id: s.id,
        device_info: s.device_info,
        ip_address: s.ip_address,
        created_at: s.created_at,
        current: s.id === currentSessionId,
      })),
    };
  }

  /** §2.1: remote sign-out of one session (owner-scoped). */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.tokens.revokeSession(sessionId);
    return { status: 'revoked' };
  }

  /** §2.1: sign out everywhere. */
  async revokeAll(userId: string) {
    await this.tokens.revokeAllForUser(userId);
    return { status: 'revoked_all' };
  }

  // ---- still scaffolded (P1+, out of current scope) ----------------------

  ssoApple() { throw new Error('Not implemented: auth.ssoApple (§2.1 P1)'); }
  ssoGoogle() { throw new Error('Not implemented: auth.ssoGoogle (§2.1 P1)'); }

  /** §4.9 — right to erasure. Soft-delete now + revoke every session; a 30-day
   *  grace precedes the hard cascade purge (incl. GCS objects), run by a job.
   *  TODO(§4.9): enqueue the purge worker; scrub analytics/LLM logs. */
  async deleteAccount(userId: string) {
    const graceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({ where: { id: userId }, data: { deleted_at: new Date() } });
    await this.tokens.revokeAllForUser(userId);
    return { status: 'scheduled_for_deletion', grace_until: graceUntil.toISOString() };
  }

  private async latestValidResetToken(userId: string) {
    const token = await this.prisma.passwordResetToken.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    if (!token || token.expires_at < new Date()) return null;
    return token;
  }
}
