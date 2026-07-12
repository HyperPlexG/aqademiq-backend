import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** §2.7 mood DTOs (snake_case). Dates are `yyyy-MM-dd` (local-midnight, §3). */

export class LogMoodDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsInt()
  @Min(0)
  @Max(4)
  mood_index!: number;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  intention?: string;
}

export class ReflectionDto {
  @IsString()
  @Length(0, 4000)
  reflection!: string;
}
