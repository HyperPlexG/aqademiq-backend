import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** §2.2/§3 task DTOs. snake_case wire contract (matches task_dto.dart §3). */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const REPEAT_KINDS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'everyNDays', 'everyNWeeks', 'everyNMonths'];

export class RepeatRuleDto {
  @IsIn(REPEAT_KINDS)
  kind!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;
}

export class CreateTaskDto {
  @IsString()
  title!: string;

  // Optional: server falls back to the user's first subject (quick-add, §2.2).
  @IsOptional()
  @IsString()
  subject_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  // Naive local wall-clock ISO string; omit for an "anytime" task.
  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Anchor / first-occurrence date (yyyy-MM-dd). Defaults to today (UTC).
  @IsOptional()
  @Matches(YMD)
  date?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepeatRuleDto)
  repeat?: RepeatRuleDto;

  @IsOptional()
  @Matches(YMD)
  until_date?: string;
}

export class QueryTasksDto {
  @IsOptional()
  @Matches(YMD)
  date?: string;

  @IsOptional()
  @Matches(YMD)
  from?: string;

  @IsOptional()
  @Matches(YMD)
  to?: string;
}

export class PatchTaskDto {
  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLETE'])
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ToggleTaskDto {
  @IsOptional()
  @Matches(YMD)
  date?: string;
}

export class MoveTasksDto {
  @Matches(YMD)
  from!: string;

  @Matches(YMD)
  to!: string;

  // Occurrence ids to move; omit/empty = every task materialized on `from`.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

export class BreakdownDto {
  @IsOptional()
  @Matches(YMD)
  date?: string;
}
