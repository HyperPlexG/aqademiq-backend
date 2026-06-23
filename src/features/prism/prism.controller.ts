import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
import { PrismService } from './prism.service';

/** §2.4/§2.11 — base route: /v1/prism-modes */
@Controller('prism-modes')
export class PrismController {
  constructor(private readonly svc: PrismService) {}

  @Get('/')
  catalog(/* TODO §2.4/§2.11: 4 modes + No sound; CDN URLs from public bucket */) {
    return this.svc.catalog();
  }
}
