import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RedeemDto } from './dto/referrals.dto';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  /** POST /referrals/validate — check a code without redeeming it. */
  async validate(dto: RedeemDto) {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (!referralCode) throw new UnprocessableEntityException('Invalid referral code');
    if (referralCode.user_id === this.rc.userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }
    return { valid: true as const };
  }

  /** POST /referrals/redeem — attribute the current user to a code's owner. */
  async redeem(dto: RedeemDto) {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (!referralCode) throw new UnprocessableEntityException('Invalid referral code');
    if (referralCode.user_id === this.rc.userId) {
      throw new BadRequestException('You cannot redeem your own code');
    }

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
