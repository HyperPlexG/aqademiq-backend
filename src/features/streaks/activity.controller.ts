import { Controller, Get, Query } from '@nestjs/common';
import { StreaksService } from './streaks.service';

/** §2.6 — activity-date endpoints (root-level paths per §5 API surface). */
@Controller()
export class ActivityController {
  constructor(private readonly svc: StreaksService) {}

  @Get('activity-dates')
  activityDates() {
    return this.svc.activityDates();
  }

  @Get('week-count')
  weekCount(@Query('date') date?: string) {
    return this.svc.weekCount(date);
  }

  @Get('today-has-activity')
  todayHasActivity() {
    return this.svc.todayHasActivity();
  }
}
