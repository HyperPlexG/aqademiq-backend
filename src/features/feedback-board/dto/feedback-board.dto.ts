import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Feedback & roadmap board DTOs (§ feedback-implementation-plan). snake_case wire. */

export class QueryPostsDto {
  @IsOptional()
  @IsIn(['top', 'new'])
  sort?: 'top' | 'new';

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  q?: string;

  /** Opaque forward cursor — a row offset encoded as a string. */
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SimilarQueryDto {
  @IsString()
  @Length(1, 200)
  q!: string;
}

export class CreatePostDto {
  @IsString()
  @Length(3, 140)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 5000)
  body?: string;

  /** category_key (planner|focus|ada|subjects|mood|streaks|sharing|other). */
  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateCommentDto {
  @IsString()
  @Length(1, 5000)
  body!: string;

  /** Parent comment id for a single-level reply. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parent_id?: number;
}

export class AdminPatchPostDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  /** Optional public note attached to a status change. */
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}

export class AdminNoteDto {
  @IsString()
  @Length(1, 5000)
  body!: string;
}

export class ChangelogEntryDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(1, 20000)
  body!: string;

  /** Link the shipped request by its public #ref. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  source_ref?: number;

  /** true → publish immediately; omit/false → save as draft. */
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class ChangelogPatchDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
