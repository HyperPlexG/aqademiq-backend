import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { FocusService } from './focus.service';
import { StartFocusDto, CheckpointFocusDto, CompleteFocusDto } from './dto/focus.dto';

/** §2.4 — base route: /v1/focus-sessions */
@Controller('focus-sessions')
export class FocusController {
  constructor(private readonly svc: FocusService) {}

  @Post()
  start(@Body() dto: StartFocusDto) {
    return this.svc.start(dto);
  }

  @Patch(':id')
  checkpoint(@Param('id') id: string, @Body() dto: CheckpointFocusDto) {
    return this.svc.checkpoint(id, dto);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteFocusDto) {
    return this.svc.complete(id, dto);
  }
}
