import { IsArray, IsInt, IsOptional, IsString, Length, Matches, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** §2.5 Ada DTOs. */
export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;
}

/** A file staged via `POST /ada/uploads`, referenced from a chat message. */
export class AdaAttachmentRefDto {
  @IsString()
  key!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsString()
  mime_type?: string;
}

export class PostMessageDto {
  @IsString()
  @Length(1, 8000)
  text!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdaAttachmentRefDto)
  attachments?: AdaAttachmentRefDto[];
}

/** POST /ada/uploads — presign a spot to stage a file for this conversation. */
export class AdaUploadInitDto {
  @IsString()
  conversation_id!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size_bytes?: number;
}

/** POST /ada/plan-week — adaload + on-demand "plan my week" trigger. */
export class PlanWeekDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start_date?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  goal?: string;
}
