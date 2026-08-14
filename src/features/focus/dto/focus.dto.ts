import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

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

  /** Optional pre-session mood, 0-4 on the wire (stored 1-5). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mood_index?: number;

  /** Holdout: true when Prism actuation was cut for this session. */
  @IsOptional()
  @IsBoolean()
  control_arm?: boolean;

  /** Prism engine build that ran this session. */
  @IsOptional()
  @IsString()
  engine_version?: string;
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

  /** Optional post-session rating, 1-5. Nothing collects it yet. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  session_rating?: number;
}
