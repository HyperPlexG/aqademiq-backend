import { Controller, Get } from '@nestjs/common';
import { FeedbackBoardService } from './feedback-board.service';

/** §feedback-plan §4 — public changelog ("What's new") under /v1/changelog. */
@Controller('changelog')
export class ChangelogController {
  constructor(private readonly svc: FeedbackBoardService) {}

  @Get()
  list() {
    return this.svc.changelog();
  }
}
