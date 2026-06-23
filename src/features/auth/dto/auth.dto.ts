import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

/** §2.1 request DTOs. Properties are snake_case to match the Flutter wire contract. */

export class SignupDto {
  @IsEmail()
  email!: string;

  // §4.1: minimum strength enforced server-side; argon2id hashed at rest.
  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class SigninDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 256)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(10)
  refresh_token!: string;
}

export class ResendOtpDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ForgotVerifyDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class ForgotResetDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 256)
  old_password!: string;

  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class LinkGuestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
