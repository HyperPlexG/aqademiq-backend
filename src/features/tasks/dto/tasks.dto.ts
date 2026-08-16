import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** §2.2/§3 task DTOs. snake_case wire contract (matches task_dto.dart §3). */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const REPEAT_KINDS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'everyNDays', 'everyNWeeks', 'everyNMonths'];
export const PART_OF_DAY = ['anytime', 'morning', 'afternoon', 'evening'];

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

  // Time-of-day bucket for tasks without a specific time. Persisted on
  // tasks.planner_section.
  @IsOptional()
  @IsIn(PART_OF_DAY)
  part_of_day?: string;
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

  @IsOptional()
  @IsIn(PART_OF_DAY)
  part_of_day?: string;
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

export class BreakdownStepDto {
  @IsString()
  title!: string;

  /** One line on what finishing this step looks like. */
  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  duration_seconds?: number;
}

export class BreakdownDto {
  @IsOptional()
  @Matches(YMD)
  date?: string;

  /**
   * Steps supplied by the caller instead of generated server-side.
   *
   * Ada's path: the agent holds the subject, the user's notes, their memories
   * and the conversation, so its steps are specific in a way this endpoint
   * cannot reconstruct from a task row — and they have already been approved
   * through the confirmation gate. Absent, the server generates them.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakdownStepDto)
  steps?: BreakdownStepDto[];

  /**
   * "Break down more" — go finer instead of regenerating the same shape.
   *
   * The task's current steps are handed to the model and it is asked to split
   * each one, and a result that came back no finer is rejected so the existing
   * steps survive. Without this the action produced another breakdown at the
   * same granularity, which read as doing nothing.
   */
  @IsOptional()
  @IsBoolean()
  refine?: boolean;
}
