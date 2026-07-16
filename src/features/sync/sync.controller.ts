import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncMutationsDto } from './dto/sync.dto';

/** §4.6 — base route: /v1/sync */
@Controller('sync')
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  @Get('changes')
  changes(@Query('since') since?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.changes(since, from, to);
  }

  @Post('mutations')
  mutations(@Body() dto: SyncMutationsDto) {
    return this.svc.mutations(dto);
  }

  @Get('cursor')
  cursor() {
    return this.svc.cursor();
  }
}
