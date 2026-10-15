// Sign in with Apple after the app moved Apple developer teams (October 2026).
//
// Apple issues each user a different id per developer team, so after the move
// a returning Apple user no longer matches their own account — and for Hide My
// Email users nothing else does either. A device that is still signed in can
// prove whose account it is, though: this re-links that account's Apple
// identity to the id Apple issues now, using a fresh Apple identity token from
// the same device. The database half (and the snapshot of every old id) is
// supabase/migrations/20261015120000_apple_team_transfer.sql.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';
import { env } from '../../_shared/env.ts';

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

/** Apple's `aud` is the app's bundle id; the same list Supabase's Apple provider uses. */
export function appleAudiences(raw = env('APPLE_OAUTH_CLIENT_IDS')): string[] {
  const listed = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return listed.length > 0 ? listed : ['com.r13.aqademiq'];
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The checks the signature verification does not make. The app hands Apple
 * the SHA-256 of a one-time nonce and sends us the raw one, so a token lifted
 * from somewhere else cannot be replayed here.
 */
export async function appleIdentityFrom(
  payload: JWTPayload & Record<string, unknown>,
  rawNonce: string,
): Promise<{ sub: string; email: string | null }> {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new HttpError(400, 'Apple token has no subject');
  }
  if (payload.nonce !== await sha256Hex(rawNonce)) {
    throw new HttpError(400, 'Apple token was not issued for this request');
  }
  // Apple only includes the email on some sign-ins; absent means "unchanged".
  const email = typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : null;
  return { sub: payload.sub, email };
}

export type RelinkStatus = 'linked' | 'already' | 'conflict' | 'no_apple_identity';

export const appleRelinkService = {
  /** Whether this account still signs in with an Apple id from before the move. */
  async status(): Promise<{ needed: boolean }> {
    if (RequestContext.isGuest) return { needed: false };
    const rows = await prismaBase().$queryRawUnsafe<Array<{ needed: boolean }>>(
      'select public.apple_relink_needed($1::uuid) as needed',
      RequestContext.userId,
    );
    return { needed: rows[0]?.needed === true };
  },

  async relink(identityToken: string, rawNonce: string): Promise<{ status: RelinkStatus }> {
    if (RequestContext.isGuest) throw new HttpError(403, 'A guest account has no Apple sign-in to re-link');

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(identityToken, appleKeys, {
        issuer: APPLE_ISSUER,
        audience: appleAudiences(),
      }));
    } catch {
      throw new HttpError(400, 'Invalid Apple identity token');
    }
    const { sub, email } = await appleIdentityFrom(payload as JWTPayload & Record<string, unknown>, rawNonce);

    const rows = await prismaBase().$queryRawUnsafe<Array<{ status: RelinkStatus }>>(
      'select public.apple_relink($1::uuid, $2, $3) as status',
      RequestContext.userId,
      sub,
      email,
    );
    const status = rows[0]?.status;
    if (!status) throw new HttpError(500, 'Re-link returned nothing');
    // Logged without ids or addresses: enough to watch the roll-out by.
    console.log(`apple-relink: ${status}`);
    return { status };
  },
};
