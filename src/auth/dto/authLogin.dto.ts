import { ApiProperty } from '@nestjs/swagger';

export class AuthLoginDto {
  @ApiProperty({ example: 'abc@gmai.com', description: 'Email' })
  email: string;

  @ApiProperty({ example: 'abc123', description: 'Password' })
  password: string;
}
