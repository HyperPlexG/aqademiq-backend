import { IsOptional, IsString, Length } from 'class-validator';

/** §2.5 Ada DTOs. */
export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;
}

export class PostMessageDto {
  @IsString()
  @Length(1, 8000)
  text!: string;
}
