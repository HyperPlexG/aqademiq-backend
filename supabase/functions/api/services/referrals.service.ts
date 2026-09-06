// §2.10 — referral codes + redemption. Port of src/features/referrals/referrals.service.ts.
// Uses the raw client (prismaBase) exactly like the Nest source: referral codes
// are looked up by their global-unique `code`, so tenancy auto-injection must NOT
// apply; user_id is passed explicitly where the Nest code passes it.
import * as crypto from 'node:crypto';
import { prismaBase } from '../../_shared/prisma.ts';
import { RequestContext } from '../../_shared/context.ts';
import { HttpError } from '../../_shared/http.ts';

export interface RedeemDto {
  code: string;
}

// Referral codes are hex, so an even length; the client's onboarding input
// (ob_referral_screen.dart) renders exactly this many boxes. Keep the two in
// sync — a mismatch is what made the code impossible to type (input was 5).
export const REFERRAL_CODE_LENGTH = 8;

/** Normalise a user-entered code for lookup: trim, strip inner spaces, upper. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

/**
 * Look a code up the one way every caller must look it up.
 *
 * Exported and shared because there are two entry points that have to agree —
 * `POST /referrals/validate` on the onboarding referral step, and
 * `POST /onboarding/complete`, which is where attribution actually happens.
 * They used to normalise differently (validate stripped inner whitespace, the
 * onboarding path only trimmed), so a code could pass the step that exists to
 * catch typos and then be rejected at the final submit, after the student had
 * filled in everything else. The app's own field filters to [A-Za-z0-9] so it
 * could not produce that input, but the two endpoints disagreeing is the bug —
 * validate is a promise about what complete will accept.
 *
 * Returns null when there is no such code. Throws for a code that exists but
 * cannot be used, so the caller does not have to re-derive why.
 */
export async function lookupUsableCode(
  raw: string,
  redeemerUserId: string,
): Promise<{ id: string; user_id: string } | null> {
  const row = await prismaBase().referralCode.findUnique({
    where: { code: normalizeCode(raw) },
  });
  if (!row) return null;
  // `is_active` has existed since the baseline schema and was read by nothing,
  // so there was no way to retire a code — one belonging to a deleted account,
  // or one being handed around somewhere it should not be.
  if (!row.is_active) throw new HttpError(422, 'That referral code is no longer active');
  if (row.user_id === redeemerUserId) {
    throw new HttpError(400, 'You cannot use your own referral code');
  }
  return { id: row.id, user_id: row.user_id };
}

/**
 * A fresh candidate code: `REFERRAL_CODE_LENGTH` uppercase hex characters.
 *
 * Exported for its test rather than because anything else calls it. The shape
 * is a cross-repo invariant — the onboarding field renders exactly this many
 * boxes — and it has already been wrong once: the field was capped at 5, so
 * the full code could not be typed and every referral silently failed. A unit
 * test is the cheap half of keeping those two numbers together.
 *
 * 8 hex characters is 4.3 billion values against 31 codes issued, so the
 * collision retry in `ensureCode` is a formality; uniqueness is really the
 * database's `referral_codes.code` unique index, which is what makes a
 * duplicate impossible rather than merely unlikely.
 */
export function generateCode(): string {
  return crypto
    .randomBytes(REFERRAL_CODE_LENGTH / 2)
    .toString('hex')
    .toUpperCase();
}

// ---- internals -----------------------------------------------------------

async function ensureCode(): Promise<string> {
  const existing = await prismaBase().referralCode.findUnique({
    where: { user_id: RequestContext.userId },
  });
  if (existing) return existing.code;
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    try {
      const created = await prismaBase().referralCode.create({
        data: { code, user_id: RequestContext.userId },
      });
      return created.code;
    } catch {
      const now = await prismaBase().referralCode.findUnique({
        where: { user_id: RequestContext.userId },
      });
      if (now) return now.code;
    }
  }
  throw new HttpError(422, 'Could not allocate a referral code');
}

export const referralsService = {
  /**
   * POST /referrals/validate — check a code exists and is usable by this user
   * without recording a redemption. Used by onboarding so typos fail on the
   * referral step instead of at final setup.
   */
  async validate(dto: RedeemDto) {
    const referralCode = await lookupUsableCode(dto.code, RequestContext.userId);
    if (!referralCode) throw new HttpError(422, 'Invalid referral code');
    return { valid: true as const };
  },

  /** POST /referrals/redeem — attribute the current user to a code's owner. */
  async redeem(dto: RedeemDto) {
    const referralCode = await lookupUsableCode(dto.code, RequestContext.userId);
    if (!referralCode) throw new HttpError(422, 'Invalid referral code');

    const existingRedemption = await prismaBase().referralRedemption.findUnique({
      where: { referred_user_id: RequestContext.userId },
    });
    if (existingRedemption) {
      throw new HttpError(400, 'You have already redeemed a referral code');
    }

    await prismaBase().referralRedemption.create({
      data: {
        referral_code_id: referralCode.id,
        referred_user_id: RequestContext.userId,
      },
    });

    return { status: 'redeemed', referrer_user_id: referralCode.user_id };
  },

  /** GET /referrals/rewards/balance — the user's own code + reward balance. */
  async rewardBalance() {
    const code = await ensureCode();
    const referralCode = await prismaBase().referralCode.findUnique({
      where: { user_id: RequestContext.userId },
      include: { redemptions: true },
    });
    const redemptionsCount = referralCode?.redemptions.length ?? 0;
    return { code, balance: redemptionsCount * 10, redemptions: redemptionsCount };
  },
};
