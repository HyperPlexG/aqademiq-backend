import { IsIn, IsOptional, IsString, Length } from 'class-validator';

/** §2.9/§4.5 device DTOs. `timezone` is IANA, stored server-side (§4.5). */

export class RegisterDeviceDto {
  @IsString()
  @Length(1, 512)
  push_token!: string;

  @IsIn(['ios', 'android'])
  platform!: string;

  @IsIn(['apns', 'fcm'])
  token_provider!: string;

  @IsString()
  @Length(1, 64)
  timezone!: string;

  @IsOptional()
  @IsIn(['granted', 'denied', 'provisional'])
  permission?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @Length(1, 512)
  push_token?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;

  @IsOptional()
  @IsIn(['granted', 'denied', 'provisional'])
  permission?: string;
}
