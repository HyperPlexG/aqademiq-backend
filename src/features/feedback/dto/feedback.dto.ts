import { IsArray, IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/** §2.12 feedback DTOs. */
export class RateDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  comment?: string;
}

export class FeedbackDto {
  @IsString()
  @Length(1, 5000)
  text!: string;
}

export class TelemetryDto {
  @IsArray()
  @IsObject({ each: true })
  events!: Record<string, unknown>[];
}
