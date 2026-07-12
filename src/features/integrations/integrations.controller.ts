import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

/** §2.12 — base route: /v1/integrations */
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  @Post('calendar/ics')
  importIcs(/* TODO §2.12: ICS subscription import */) {
    return this.svc.importIcs();
  }

  @Post('google/oauth/callback')
  googleOauth(/* TODO §2.12: Google Calendar import (Apple=on-device) */) {
    return this.svc.googleOauth();
  }
}
