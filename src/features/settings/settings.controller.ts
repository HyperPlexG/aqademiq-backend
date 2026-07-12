import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  UpdateSettingsDto,
  UpdateEmailPrefsDto,
  UpdateNotificationPrefsDto,
  PutChannelsDto,
} from './dto/settings.dto';

/** §2.8/§2.9 — base route: /v1/me */
@Controller('me')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('settings')
  getSettings() {
    return this.svc.getSettings();
  }

  @Patch('settings')
  patchSettings(@Body() dto: UpdateSettingsDto) {
    return this.svc.patchSettings(dto);
  }

  @Get('email-preferences')
  getEmailPrefs() {
    return this.svc.getEmailPrefs();
  }

  @Patch('email-preferences')
  patchEmailPrefs(@Body() dto: UpdateEmailPrefsDto) {
    return this.svc.patchEmailPrefs(dto);
  }

  @Get('notification-preferences')
  getNotificationPrefs() {
    return this.svc.getNotificationPrefs();
  }

  @Patch('notification-preferences')
  patchNotificationPrefs(@Body() dto: UpdateNotificationPrefsDto) {
    return this.svc.patchNotificationPrefs(dto);
  }

  @Get('notification-channels')
  getNotificationChannels() {
    return this.svc.getNotificationChannels();
  }

  @Put('notification-channels')
  putNotificationChannels(@Body() dto: PutChannelsDto) {
    return this.svc.putNotificationChannels(dto);
  }

  @Get('export')
  exportData() {
    return this.svc.exportData();
  }
}
