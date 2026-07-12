import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto } from './dto/onboarding.dto';

/** §2.1 — base route: /v1/onboarding */
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('complete')
  complete(@Body() dto: CompleteOnboardingDto) {
    return this.svc.complete(dto);
  }
}
