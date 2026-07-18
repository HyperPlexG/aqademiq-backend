import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { FeedbackBoardService } from './feedback-board.service';
import {
  AdminNoteDto,
  AdminPatchPostDto,
  ChangelogEntryDto,
  ChangelogPatchDto,
} from './dto/feedback-board.dto';

/**
 * §feedback-plan §4/§7 — admin surface under /v1/admin. Gated inside the service
 * by the FEEDBACK_ADMIN_IDS allowlist (roles are a P2 concern). A status change
 * writes an attributed status_changes row, notifies subscribers, and (on
 * `shipped`) auto-drafts a changelog entry.
 */
@Controller('admin')
export class FeedbackBoardAdminController {
  constructor(private readonly svc: FeedbackBoardService) {}

  @Patch('feedback/posts/:ref')
  patchPost(@Param('ref', ParseIntPipe) ref: number, @Body() dto: AdminPatchPostDto) {
    return this.svc.adminPatchPost(ref, dto);
  }

  @Post('feedback/posts/:ref/notes')
  addNote(@Param('ref', ParseIntPipe) ref: number, @Body() dto: AdminNoteDto) {
    return this.svc.adminAddNote(ref, dto);
  }

  @Get('feedback/queue')
  queue() {
    return this.svc.adminQueue();
  }

  @Post('changelog')
  createChangelog(@Body() dto: ChangelogEntryDto) {
    return this.svc.adminCreateChangelog(dto);
  }

  @Patch('changelog/:id')
  patchChangelog(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangelogPatchDto) {
    return this.svc.adminPatchChangelog(id, dto);
  }
}
