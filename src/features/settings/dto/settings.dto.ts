import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** §2.8/§2.9 settings DTOs. Times are local wall-clock `HH:MM` (§4.5). */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme_mode?: string;

  @IsOptional()
  @IsString()
  prism_default_mode?: string;

  @IsOptional()
  @IsIn(['Chime', 'Pulse', 'Glass', 'Drop', 'None'])
  notification_sound?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time_morning?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time_review?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  daily_focus_goal_min?: number;

  @IsOptional()
  work_best_times?: unknown;

  @IsOptional()
  @IsString()
  education_level?: string;
}

export class UpdateEmailPrefsDto {
  @IsOptional()
  @IsBoolean()
  product_updates?: boolean;

  @IsOptional()
  @IsBoolean()
  study_tips?: boolean;

  @IsOptional()
  @IsBoolean()
  offers?: boolean;

  @IsOptional()
  @IsBoolean()
  surveys?: boolean;
}

export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsIn(['Chime', 'Pulse', 'Glass', 'Drop', 'None'])
  notification_sound?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time_morning?: string;

  @IsOptional()
  @Matches(HHMM)
  notification_time_review?: string;
}

export class ChannelPrefDto {
  @IsString()
  channel_key!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Matches(HHMM)
  send_time?: string;
}

export class PutChannelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelPrefDto)
  channels!: ChannelPrefDto[];
}
