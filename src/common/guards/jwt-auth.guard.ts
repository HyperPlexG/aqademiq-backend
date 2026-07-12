import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../infra/token.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * §4.1 token model: short-lived RS256 access JWT verified with the public key
 * (jose), then checked against the Redis deny-list for instant revocation.
 * Attaches { userId, isGuest, sessionId } to the request for downstream tenancy.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    // RS256 signature verification + deny-list check (throws on failure).
    const claims = await this.tokens.verifyAccess(token);
    req.userId = claims.sub;
    req.isGuest = claims.is_guest;
    req.sessionId = claims.sid;
    return true;
  }
}
