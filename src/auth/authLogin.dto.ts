import { ApiProperty } from '@nestjs/swagger';

export class AuthLoginDto {
  @ApiProperty({ example: 'abc@gmai.com' })
  email: string;

  @ApiProperty({ example: 'abc123' })
  password: string;
}