import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdaService } from './ada.service';
import { CreateConversationDto, PostMessageDto } from './dto/ada.dto';

/** §2.5/§4.3 — base route: /v1/ada */
@Controller('ada')
export class AdaController {
  constructor(private readonly svc: AdaService) {}

  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto) {
    return this.svc.createConversation(dto);
  }

  @Get('conversations')
  listConversations() {
    return this.svc.listConversations();
  }

  @Get('conversations/:id/messages')
  listMessages(@Param('id') id: string) {
    return this.svc.listMessages(id);
  }

  @Post('conversations/:id/messages')
  postMessage(@Param('id') id: string, @Body() dto: PostMessageDto) {
    return this.svc.postMessage(id, dto);
  }

  @Post('conversations/:cid/messages/:mid/apply-plan')
  applyPlan(@Param('cid') cid: string, @Param('mid') mid: string) {
    return this.svc.applyPlan(cid, mid);
  }

  @Post('conversations/:id/archive')
  archive(@Param('id') id: string) {
    return this.svc.archive(id);
  }

  @Post('chat/clear')
  clear() {
    return this.svc.clear();
  }

  @Post('uploads')
  upload() {
    return this.svc.upload();
  }

  @Post('plan-week')
  planWeek() {
    return this.svc.planWeek();
  }
}
