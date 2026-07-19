// Supabase Auth token verification + Hono guard — port of
// src/common/supabase-jwt.ts and src/common/guards/jwt-auth.guard.ts.
//
// Access tokens are asymmetric ES256 JWTs signed by the project's Auth signing
// key. Verify the signature against the project JWKS, then run the request under
// RequestContext so services + Prisma tenancy read the user id without threading.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Context, Next } from 'hono';
import { RequestContext, type RequestIdentity } from './context.ts';
import { HttpError } from './http.ts';
import { requireEnv } from './env.ts';

let jwks: JWTVerifyGetKey | undefined;
let issuer: string | undefined;

function init(): void {
  const base = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  issuer = `${base}/auth/v1`;
  jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
}

export interface SupabaseClaims {
  userId: string;
  isGuest: boolean;
  sessionId: string | null;
}

/** Verify signature + issuer/audience. Throws on any failure. */
export async function verifySupabaseToken(token: string): Promise<SupabaseClaims> {
  if (!jwks || !issuer) init();
  const { payload } = await jwtVerify(token, jwks!, { issuer: issuer!, audience: 'authenticated' });
  if (!payload.sub) throw new Error('Token missing sub claim');
  const p = payload as Record<string, unknown>;
  return {
    userId: payload.sub,
    isGuest: p.is_anonymous === true,
    sessionId: (p.session_id as string | undefined) ?? null,
  };
}

/**
 * Hono guard. Paths in `publicPaths` (relative to the /api/v1 basePath, e.g.
 * '/healthz') bypass auth. Everything else requires a valid Bearer token and
 * runs the downstream handler inside RequestContext.
 */
export function supabaseAuth(publicPaths: Set<string>) {
  return async (c: Context, next: Next) => {
    const path = c.req.path.replace(/^\/api\/v1/, '') || '/';
    if (publicPaths.has(path)) return next();

    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Missing bearer token');

    let claims: SupabaseClaims;
    try {
      claims = await verifySupabaseToken(token);
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    const identity: RequestIdentity = {
      userId: claims.userId,
      isGuest: claims.isGuest,
      sessionId: claims.sessionId ?? '',
    };
    return RequestContext.run(identity, () => next());
  };
}
