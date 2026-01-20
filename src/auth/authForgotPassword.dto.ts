import { ApiProperty } from '@nestjs/swagger';

export class AuthForgotPasswordDTO {
  @ApiProperty({ example: 'abc@gmail.com', description: 'Email' })
  email: string;
}
