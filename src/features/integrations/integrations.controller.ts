import { Body, Controller, Post } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { GoogleOauthCallbackDto, ImportIcsDto } from './dto/integrations.dto';

/** §2.12 — base route: /v1/integrations */
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  /** Import an ICS subscription (URL or raw text). */
  @Post('calendar/ics')
  importIcs(@Body() dto: ImportIcsDto) {
    return this.svc.importIcs(dto);
  }

  /** Exchange a Google OAuth code and import upcoming Calendar events. */
  @Post('google/oauth/callback')
  googleOauth(@Body() dto: GoogleOauthCallbackDto) {
    return this.svc.googleOauth(dto);
  }
}
