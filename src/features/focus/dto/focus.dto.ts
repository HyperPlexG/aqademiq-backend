import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** §2.4 focus-session DTOs. */
export class StartFocusDto {
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  planned_min?: number;

  @IsOptional()
  @IsString()
  prism_mode?: string;

  // Linked task occurrence (series id + occurrence date), for done-sync on complete.
  @IsOptional()
  @IsString()
  task_id?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  task_date?: string;
}

export class CheckpointFocusDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  elapsed_sec?: number;

  @IsOptional()
  @IsIn(['RUNNING', 'PAUSED'])
  status?: string;
}

export class CompleteFocusDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  elapsed_sec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mood_index?: number;
}
