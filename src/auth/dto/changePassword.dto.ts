import { isNotEmpty, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  oldPassword: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword: string;

  @IsNotEmpty()
  confirmNewPassword: string;

  @IsOptional()
  twoFactorAuthenticationCode?: string;
}
