import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RedeemDto } from './dto/referrals.dto';

/** Normalise a user-entered code for lookup: trim, strip inner spaces, upper. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  /**
   * Look a code up the one way every caller must look it up.
   *
   * NOTE: the deployed Deno port additionally shares this helper with
   * `onboarding.service.ts`, which is where attribution actually happens — the
   * app never calls `/referrals/redeem`; it passes `referral_code` to
   * `POST /onboarding/complete`. This reference tree has no referral handling
   * in onboarding at all, so port that path from
   * `supabase/functions/api/services/onboarding.service.ts`, not from here.
   */
  private async lookupUsableCode(raw: string) {
    const row = await this.prisma.referralCode.findUnique({
      where: { code: normalizeCode(raw) },
    });
    if (!row) return null;
    // `is_active` has existed since the baseline schema and was read by
    // nothing, so there was no way to retire a code.
    if (!row.is_active) {
      throw new UnprocessableEntityException('That referral code is no longer active');
    }
    if (row.user_id === this.rc.userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }
    return row;
  }

  /** POST /referrals/validate — check a code without redeeming it. */
  async validate(dto: RedeemDto) {
    const referralCode = await this.lookupUsableCode(dto.code);
    if (!referralCode) throw new UnprocessableEntityException('Invalid referral code');
    return { valid: true as const };
  }

  /** POST /referrals/redeem — attribute the current user to a code's owner. */
  async redeem(dto: RedeemDto) {
    const referralCode = await this.lookupUsableCode(dto.code);
    if (!referralCode) throw new UnprocessableEntityException('Invalid referral code');

    const existingRedemption = await this.prisma.referralRedemption.findUnique({
      where: { referred_user_id: this.rc.userId },
    });
    if (existingRedemption) {
      throw new BadRequestException('You have already redeemed a referral code');
    }

    await this.prisma.referralRedemption.create({
      data: {
        referral_code_id: referralCode.id,
        referred_user_id: this.rc.userId,
      },
    });

    return { status: 'redeemed', referrer_user_id: referralCode.user_id };
  }

  /** GET /referrals/rewards/balance — the user's own code + reward balance. */
  async rewardBalance() {
    const code = await this.ensureCode();
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { user_id: this.rc.userId },
      include: { redemptions: true },
    });
    const redemptionsCount = referralCode?.redemptions.length ?? 0;
    return { code, balance: redemptionsCount * 10, redemptions: redemptionsCount };
  }

  // ---- internals ---------------------------------------------------------

  private async ensureCode(): Promise<string> {
    const existing = await this.prisma.referralCode.findUnique({
      where: { user_id: this.rc.userId },
    });
    if (existing) return existing.code;
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
      try {
        const created = await this.prisma.referralCode.create({
          data: { code, user_id: this.rc.userId },
        });
        return created.code;
      } catch {
        const now = await this.prisma.referralCode.findUnique({
          where: { user_id: this.rc.userId },
        });
        if (now) return now.code;
      }
    }
    throw new UnprocessableEntityException('Could not allocate a referral code');
  }
}
