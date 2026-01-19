import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './authRegister.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthLoginDto } from './authLogin.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Dang ky tai khoan' })
  @ApiBody({ type: AuthRegisterDto })
  async register(@Body() registerDto: AuthRegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Gửi mã OTP quên mật khẩu qua MailHog' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }
  /* code mac dinh he thong
  @Post()
  create(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.create(createAuthDto);
  }

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
    return this.authService.update(+id, updateAuthDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
  */
}
