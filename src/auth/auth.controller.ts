import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './dto/authRegister.dto';
import { AuthForgotPasswordDTO } from './dto/authForgotPassword.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthLoginDto } from './dto/authLogin.dto';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register' })
  @ApiBody({ type: AuthRegisterDto })
  async register(@Body() registerDto: AuthRegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  async login(@Body() loginDto: AuthLoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('forgotPassword')
  @ApiOperation({ summary: 'Forgot Password' })
  async forgotPassword(@Body() forgotPasswordDto: AuthForgotPasswordDTO) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }
  /* 
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
