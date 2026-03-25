import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  BadRequestException, 
  ForbiddenException 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';

import { AuthRegisterDto } from './dto/authRegister.dto';
import { AuthLoginDto } from './dto/authLogin.dto';
import { AuthForgotPasswordDTO } from './dto/authForgotPassword.dto';
import { TwoFactorAuthDto } from './dto/twoFactorAuth.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  // ==================== PUBLIC ROUTES ====================

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: AuthRegisterDto })
  async register(@Body() registerDto: AuthRegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  @ApiBody({ type: AuthLoginDto })
  async login(@Body() loginDto: AuthLoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('forgotPassword')
  @ApiOperation({ summary: 'Forgot Password' })
  @ApiBody({ type: AuthForgotPasswordDTO })
  async forgotPassword(@Body() forgotPasswordDto: AuthForgotPasswordDTO) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // ==================== PROTECTED ROUTES (2FA & Password) ====================

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Setup - Generate QR Code' })
  async setup2FA(@Request() req) {
    if (req.user?.isTwoFactorPending) {
      throw new ForbiddenException('2FA setup is pending');
    }

    return this.authService.setup2FA(req.user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Enable - Verify OTP and turn on 2FA' })
  async enable2FA(
    @Request() req, 
    @Body('twoFactorAuthCode') code: string,
  ) {
    return this.authService.enable2FA(req.user.userId, code);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Verify - Login with OTP' })
  async verify2FA(
    @Request() req,
    @Body('twoFactorAuthCode') code: string,
  ) {
    return this.authService.verify2FA(req.user.userId, code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Disable - Turn off 2FA' })
  async disable2FA(
    @Request() req,
    @Body() dto: TwoFactorAuthDto,
  ) {
    if (!dto || !dto.twoFactorAuthenticationCode) {
      throw new BadRequestException('Two factor authentication code is required');
    }

    return this.authService.disable2FA(req.user.userId, dto.twoFactorAuthenticationCode);
  }

  @Post('changePassword')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change Password' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @Request() req,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, dto);
  }
}
