import { Module } from '@nestjs/common';
import { FeedbackBoardController } from './feedback-board.controller';
import { FeedbackBoardAdminController } from './feedback-board.admin.controller';
import { ChangelogController } from './changelog.controller';
import { FeedbackBoardService } from './feedback-board.service';

/** Native feedback & roadmap board (nolt parity, phase 1). */
@Module({
  controllers: [FeedbackBoardController, FeedbackBoardAdminController, ChangelogController],
  providers: [FeedbackBoardService],
  exports: [FeedbackBoardService],
})
export class FeedbackBoardModule {}
