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

// ---- internals -----------------------------------------------------------

async function ensureCode(): Promise<string> {
  const existing = await prismaBase().referralCode.findUnique({
    where: { user_id: RequestContext.userId },
  });
  if (existing) return existing.code;
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
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
  /** POST /referrals/redeem — attribute the current user to a code's owner. */
  async redeem(dto: RedeemDto) {
    const referralCode = await prismaBase().referralCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (!referralCode) throw new HttpError(422, 'Invalid referral code');
    if (referralCode.user_id === RequestContext.userId) {
      throw new HttpError(400, 'You cannot redeem your own code');
    }

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
