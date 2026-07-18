import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Shared verifier for Supabase Auth access tokens (asymmetric ES256, signed by
 * the project's Auth signing key). Used by the HTTP guard and the realtime
 * gateway so JWKS fetching/caching happens once per process.
 *
 * Env: SUPABASE_URL — https://<ref>.supabase.co (issuer + JWKS derived from it).
 */
export interface SupabaseClaims {
  userId: string;             // = auth.users.id = profiles.id
  isGuest: boolean;           // Supabase anonymous sign-in
  sessionId: string | null;
}

let jwks: JWTVerifyGetKey | undefined;
let issuer: string | undefined;

function init(): void {
  const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('SUPABASE_URL is required to verify Supabase auth tokens');
  issuer = `${base}/auth/v1`;
  jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
}

/** Verify signature + issuer/audience. Throws on any failure. */
export async function verifySupabaseToken(token: string): Promise<SupabaseClaims> {
  if (!jwks || !issuer) init();
  const { payload } = await jwtVerify(token, jwks!, { issuer: issuer!, audience: 'authenticated' });
  if (!payload.sub) throw new Error('Token missing sub claim');
  return {
    userId: payload.sub,
    isGuest: (payload as Record<string, unknown>).is_anonymous === true,
    sessionId: ((payload as Record<string, unknown>).session_id as string | undefined) ?? null,
  };
}
