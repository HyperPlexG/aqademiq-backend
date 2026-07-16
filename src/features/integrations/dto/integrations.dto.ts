import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * §2.12 — import an external calendar by ICS. Supply either a subscription
 * `url` (webcal/https) OR raw `ics` text; at least one is required.
 */
export class ImportIcsDto {
  @ValidateIf((o: ImportIcsDto) => !o.ics)
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ValidateIf((o: ImportIcsDto) => !o.url)
  @IsString()
  @MaxLength(1_000_000)
  ics?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  calendar_email?: string;
}

/** §2.12 — Google Calendar OAuth authorization-code exchange + import. */
export class GoogleOauthCallbackDto {
  @IsString()
  @MaxLength(2048)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirect_uri?: string;
}
