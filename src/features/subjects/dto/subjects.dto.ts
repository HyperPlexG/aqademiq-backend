import { IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

/** §2.3 subject DTOs (snake_case). color_hex is strict `#RRGGBB` (no alpha, §3). */

const HEX = /^#[0-9a-fA-F]{6}$/;

export class CreateSubjectDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @Matches(HEX, { message: 'color_hex must be #RRGGBB' })
  color_hex!: string;

  // Defaults to the user's active semester when omitted.
  @IsOptional()
  @IsString()
  semester_id?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  credits?: number;

  @IsOptional()
  @IsString()
  prof?: string;

  @IsOptional()
  @IsString()
  target_grade?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mood?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Matches(HEX, { message: 'color_hex must be #RRGGBB' })
  color_hex?: string;

  @IsOptional()
  @IsString()
  semester_id?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  credits?: number;

  @IsOptional()
  @IsString()
  prof?: string;

  @IsOptional()
  @IsString()
  target_grade?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  mood?: number;
}
