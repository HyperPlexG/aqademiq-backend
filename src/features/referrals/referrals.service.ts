import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../infra/prisma.service';
import { RequestContext } from '../../common/request-context';
import { RedeemDto } from './dto/referrals.dto';

/**
 * §2.10 — referral codes. Each user owns one shareable code (created on demand).
 * `redeem` records attribution intent; the full reward ledger is P2, so balance
 * is currently 0 (the endpoint is functional so the referral screen works).
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rc: RequestContext,
  ) {}

  /** POST /referrals/redeem — attribute the current user to a code's owner. */
  async redeem(dto: RedeemDto) {
    const referral = await this.prisma.referral.findUnique({ where: { code: dto.code.toUpperCase() } });
    if (!referral) throw new UnprocessableEntityException('Invalid referral code');
    if (referral.owner_user_id === this.rc.userId) {
      throw new BadRequestException('You cannot redeem your own code');
    }
    // TODO(§2.10 P2): persist ReferralRedemption + credit the reward ledger.
    return { status: 'redeemed', referrer_user_id: referral.owner_user_id };
  }

  /** GET /referrals/rewards/balance — the user's own code + (P2) reward balance. */
  async rewardBalance() {
    const code = await this.ensureCode();
    return { code, balance: 0, redemptions: 0 };
  }

  // ---- internals ---------------------------------------------------------

  private async ensureCode(): Promise<string> {
    const existing = await this.prisma.referral.findUnique({ where: { owner_user_id: this.rc.userId } });
    if (existing) return existing.code;
    // Generate a short unique code; retry on the rare collision.
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
      try {
        const created = await this.prisma.referral.create({ data: { code, owner_user_id: this.rc.userId } });
        return created.code;
      } catch {
        const now = await this.prisma.referral.findUnique({ where: { owner_user_id: this.rc.userId } });
        if (now) return now.code;
      }
    }
    throw new UnprocessableEntityException('Could not allocate a referral code');
  }
}
