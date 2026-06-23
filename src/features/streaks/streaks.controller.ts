import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
import { StreaksService } from './streaks.service';

/** §2.6/§4.7 — base route: /v1/streaks */
@Controller('streaks')
export class StreaksController {
  constructor(private readonly svc: StreaksService) {}

  @Get('current')
  current(/* TODO §2.6/§4.7: server-authoritative; tz day-bucketed; Redis cache + nightly recompute */) {
    return this.svc.current();
  }
}
