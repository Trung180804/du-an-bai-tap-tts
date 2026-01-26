import { TwoFactorAuthDto } from './dto/twoFactorAuth.dto';
import { Controller, Post, Body, UnauthorizedException, BadRequestException, ForbiddenException, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './dto/authRegister.dto';
import { AuthForgotPasswordDTO } from './dto/authForgotPassword.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthLoginDto } from './dto/authLogin.dto';
import { UsersService } from '@/users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private usersService: UsersService,
  ) {}

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

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Enable - Verify OTP and turn on 2FA' })
  async enable2FA(@Request() req, @Body('twoFactorAuthCode') code: string) {
    return this.authService.enable2FA(req.user.userId, code);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Setup' })
  async setup2FA(@Request() req) {
    if (req.user.isTwoFactorPending) {
      throw new ForbiddenException('You must verify 2FA before setting it up');
    }
    return this.authService.setup2FA(req.user.userId);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Verify' })
  async verify2FA(@Request() req, @Body('twoFactorAuthCode') code: string) {
    return this.authService.verify2FA(req.user.userId, code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Disable' })
  async disable2FA(@Request() req, @Body() dto: TwoFactorAuthDto) {
    if (req.user.isTwoFactorPending) {
      throw new ForbiddenException('You must verify 2FA before disabling it');
    }
    if (!dto.twoFactorAuthenticationCode) {
      throw new BadRequestException('Code is required to disable 2FA');
    }
    return this.authService.disable2FA(
      req.user.userId,
      dto.twoFactorAuthenticationCode,
    );
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
