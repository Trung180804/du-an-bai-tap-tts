import { ApiProperty } from '@nestjs/swagger';

export class AuthRegisterDto {
  @ApiProperty({ example: 'abc@gmail.com', description: 'Email' })
  email: string;

  @ApiProperty({ example: 'abc@123', description: 'Password' })
  password: string;
}