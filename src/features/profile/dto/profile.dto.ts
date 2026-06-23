import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** §2.8 profile DTO. avatar_index 0–7 preset (no photo upload for MVP). */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  gender?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  university?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  program?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  avatar_index?: number;
}
