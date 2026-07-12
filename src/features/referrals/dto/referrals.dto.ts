import { IsString, Length } from 'class-validator';

/** §2.10 referral DTO. */
export class RedeemDto {
  @IsString()
  @Length(4, 32)
  code!: string;
}
