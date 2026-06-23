import { Body, Controller, Get, Post, Delete, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
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
import type { SessionInfo } from '../../infra/token.service';

/** The guard attaches these to the request after RS256 verification (§4.1). */
type AuthedRequest = Request & { userId: string; sessionId: string; isGuest: boolean };

/** Pull device/IP context off the request for session bookkeeping (§4.1). */
function sessionInfo(req: Request): SessionInfo {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]?.trim()) || req.ip || null;
  return { deviceInfo: req.headers['user-agent'] ?? null, ipAddress: ip };
}

/** §2.1/§4.1 — base route: /v1/auth */
@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Public()
  @Post('guest')
  guest(@Req() req: Request) {
    return this.svc.guest(sessionInfo(req));
  }

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.svc.signup(dto);
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.svc.verifyOtp(dto, sessionInfo(req));
  }

  @Public()
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.svc.resendOtp(dto);
  }

  @Public()
  @Post('signin')
  signin(@Body() dto: SigninDto, @Req() req: Request) {
    return this.svc.signin(dto, sessionInfo(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.svc.refresh(dto, sessionInfo(req));
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.svc.forgotPassword(dto);
  }

  @Public()
  @Post('forgot-password/verify')
  forgotVerify(@Body() dto: ForgotVerifyDto) {
    return this.svc.forgotVerify(dto);
  }

  @Public()
  @Post('forgot-password/reset')
  forgotReset(@Body() dto: ForgotResetDto) {
    return this.svc.forgotReset(dto);
  }

  // Authenticated below — guard verifies the bearer token and attaches userId/sessionId.

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: AuthedRequest) {
    return this.svc.changePassword(req.userId, req.sessionId, dto);
  }

  @Post('link-guest')
  linkGuest(@Body() dto: LinkGuestDto, @Req() req: AuthedRequest) {
    return this.svc.linkGuest(req.userId, dto);
  }

  @Post('signout')
  signout(@Req() req: AuthedRequest) {
    return this.svc.signout(req.sessionId);
  }

  @Get('sessions')
  listSessions(@Req() req: AuthedRequest) {
    return this.svc.listSessions(req.userId, req.sessionId);
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.revokeSession(req.userId, id);
  }

  @Post('sessions/revoke-all')
  revokeAll(@Req() req: AuthedRequest) {
    return this.svc.revokeAll(req.userId);
  }

  @Public()
  @Post('sso/apple')
  ssoApple(/* TODO §2.1/§4.1: verify Apple JWKS */) {
    return this.svc.ssoApple();
  }

  @Public()
  @Post('sso/google')
  ssoGoogle(/* TODO §2.1/§4.1: verify Google JWKS */) {
    return this.svc.ssoGoogle();
  }

  @Delete('account')
  deleteAccount(@Req() req: AuthedRequest) {
    return this.svc.deleteAccount(req.userId);
  }
}
