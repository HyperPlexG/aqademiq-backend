import { Controller, Get } from '@nestjs/common';
import { ProfileService } from './profile.service';

/** §2.6/§2.8 — aggregated stats for the Profile/Stats screen: GET /v1/me/stats */
@Controller('me')
export class StatsController {
  constructor(private readonly svc: ProfileService) {}

  @Get('stats')
  stats() {
    return this.svc.stats();
  }
}
