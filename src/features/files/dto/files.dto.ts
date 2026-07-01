import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

/** §2.3/§4.4 file DTOs. `kind` is normalized server-side to a known set. */
export class InitUploadDto {
  @IsString()
  subject_id!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size_bytes?: number;
}

/** §2.3/§4.4 — upload staged before its parent subject exists (onboarding
 *  step 3: "upload syllabus" happens before the wizard's final submit, so
 *  there's no subject_id yet to hang the file off of). */
export class InitStagingUploadDto {
  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size_bytes?: number;
}

export class PatchFileDto {
  @IsOptional()
  @IsBoolean()
  important?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}
