import { IsArray, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** §2.1 onboarding completion payload (7-step wizard → profile/semester/subjects/settings). */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export class OnboardingSubjectDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @Matches(HEX)
  color_hex?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mood?: number;

  // From `POST /uploads/staging/init` + a client PUT — attaches a syllabus
  // to this subject once it's created in the same transaction (ob3).
  @IsOptional()
  @IsString()
  syllabus_staging_key?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  syllabus_file_name?: string;

  @IsOptional()
  @IsString()
  syllabus_mime_type?: string;
}

export class OnboardingSemesterDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @Matches(YMD)
  start!: string;

  @Matches(YMD)
  end!: string;
}

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  referral_code?: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @IsOptional()
  @IsString()
  education_level?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingSemesterDto)
  semester?: OnboardingSemesterDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingSubjectDto)
  subjects?: OnboardingSubjectDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  daily_focus_goal_min?: number;

  @IsOptional()
  work_best_times?: unknown;
}
