import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** §2.3 semester DTOs. snake_case wire contract. Dates are `yyyy-MM-dd`. */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateSemesterDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @Matches(YMD)
  start!: string;

  @Matches(YMD)
  end!: string;
}

export class UpdateSemesterDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Matches(YMD)
  start?: string;

  @IsOptional()
  @Matches(YMD)
  end?: string;
}
