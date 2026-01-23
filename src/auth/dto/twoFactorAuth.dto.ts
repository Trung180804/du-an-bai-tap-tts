import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class TwoFactorAuthDto {
  @ApiProperty()
  @IsNotEmpty()
  twoFactorAuthenticationCode: string;
}
