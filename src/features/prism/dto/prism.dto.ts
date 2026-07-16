import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const MODE_KEYS = ['none', 'rain', 'forest', 'cafe', 'whitenoise'];

/** §2.4/§2.11 — persisted per-user Prism defaults. All fields optional (patch). */
export class UpdatePrismPreferencesDto {
  @IsOptional()
  @IsIn(MODE_KEYS)
  default_mode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  volume_level?: number;

  @IsOptional()
  @IsBoolean()
  adaptive_audio?: boolean;

  @IsOptional()
  @IsBoolean()
  play_in_focus?: boolean;
}
