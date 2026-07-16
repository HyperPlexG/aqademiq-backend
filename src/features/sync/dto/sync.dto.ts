import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export const MUTATION_TYPES = [
  'task.create',
  'task.patch',
  'task.toggle',
  'task.delete',
  'task.move',
  'mood.log',
  'mood.reflect',
  'tag.create',
  'tag.delete',
  'subject.create',
  'subject.patch',
  'subject.delete',
] as const;

export type MutationType = (typeof MUTATION_TYPES)[number];

/** One queued offline mutation. `op_id` is a client-generated idempotency id
 *  echoed back in the result so the client can reconcile its outbox. */
export class SyncMutationDto {
  @IsString()
  op_id!: string;

  @IsIn(MUTATION_TYPES as unknown as string[])
  type!: MutationType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

/** §4.6 — flush a batch of offline mutations in order. */
export class SyncMutationsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncMutationDto)
  mutations!: SyncMutationDto[];
}
