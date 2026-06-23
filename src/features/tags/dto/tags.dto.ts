import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** §2.8 study-tag DTO. */
export class CreateTagDto {
  @IsString()
  @Length(1, 60)
  label!: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be #RRGGBB' })
  color?: string;
}
