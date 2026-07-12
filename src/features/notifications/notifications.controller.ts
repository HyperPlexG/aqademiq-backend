import { Controller, Get, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';

/** §2.9 — base route: /v1/me/notifications */
@Controller('me/notifications')
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly reminders: RemindersService,
  ) {}

  @Get('history')
  history() {
    return this.svc.history();
  }

  @Get('inbox')
  inbox() {
    return this.svc.inbox();
  }

  @Post('test')
  test() {
    return this.svc.test();
  }

  /** Manually trigger the reminder sweep for the current user (test/debug).
   *  `?force=morning|review` bypasses the time-of-day match. */
  @Post('sweep')
  sweep(@Query('force') force?: string) {
    return this.reminders.triggerForCurrentUser(force);
  }
}
