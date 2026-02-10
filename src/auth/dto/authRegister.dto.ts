import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

export class AuthRegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['vi', 'en'])
  @IsOptional()
  lang?: string;
}
