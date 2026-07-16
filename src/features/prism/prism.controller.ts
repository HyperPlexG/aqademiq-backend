import { Body, Controller, Get, Put } from '@nestjs/common';
import { PrismService } from './prism.service';
import { UpdatePrismPreferencesDto } from './dto/prism.dto';

/** §2.4/§2.11 — base route: /v1/prism-modes */
@Controller('prism-modes')
export class PrismController {
  constructor(private readonly svc: PrismService) {}

  /** Static catalog: 4 modes + "No sound"; CDN URLs from the public bucket. */
  @Get('/')
  catalog() {
    return this.svc.catalog();
  }

  /** The caller's saved Prism defaults (chosen mode, volume, adaptive, in-focus). */
  @Get('preferences')
  getPreferences() {
    return this.svc.getPreferences();
  }

  /** Upsert the caller's Prism defaults. */
  @Put('preferences')
  setPreferences(@Body() dto: UpdatePrismPreferencesDto) {
    return this.svc.setPreferences(dto);
  }
}
