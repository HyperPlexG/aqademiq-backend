import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifySupabaseToken } from '../supabase-jwt';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Supabase Auth token model: access tokens are asymmetric (ES256) JWTs signed
 * by the project's Auth signing key. We verify the signature against the
 * project JWKS, then attach { userId, isGuest, sessionId } to the request for
 * downstream tenancy (RequestContext + PrismaService.tenant).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');

    try {
      const claims = await verifySupabaseToken(token);
      req.userId = claims.userId;
      req.isGuest = claims.isGuest;
      req.sessionId = claims.sessionId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    return true;
  }
}
