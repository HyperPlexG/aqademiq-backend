import { Body, Controller, Get, Post } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { RedeemDto } from './dto/referrals.dto';

/** §2.10 — base route: /v1/referrals */
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly svc: ReferralsService) {}

  @Post('validate')
  validate(@Body() dto: RedeemDto) {
    return this.svc.validate(dto);
  }

  @Post('redeem')
  redeem(@Body() dto: RedeemDto) {
    return this.svc.redeem(dto);
  }

  @Get('rewards/balance')
  rewardBalance() {
    return this.svc.rewardBalance();
  }
}
