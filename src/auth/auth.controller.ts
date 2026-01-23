import { TwoFactorAuthDto } from './dto/twoFactorAuth.dto';
import { Controller, Post, Body, UnauthorizedException, BadRequestException, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './dto/authRegister.dto';
import { AuthForgotPasswordDTO } from './dto/authForgotPassword.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthLoginDto } from './dto/authLogin.dto';
import { UsersService } from '@/users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { access } from 'fs';

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
  async enable2FA(
    @Request() req, 
    @Body('twoFactorAuthCode') code: string,
) {
    const user = await this.usersService.findOne(req.user.userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.twoFactorAuthSecret) {
      throw new BadRequestException('Please setup 2FA first');
    }

    const isValid = await this.authService.isTwoFactorAuthenticationCodeValid(
      code,
      user,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    user.isTwoFactorAuthEnabled = true;
    await user.save();

    return { message: '2FA enabled successfully' };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Setup' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
      required: ['userId'],
    },
  })
  async setup2FA(@Request() req) {
    const userId = req.user.userId;
    const setupUser = await this.usersService.findOne(userId);
    if (!setupUser) {
      throw new BadRequestException('User not found');
    }

    const { qrDataUrl } =
      await this.authService.generateTwoFactorAuthenticationSecret(setupUser);

    return qrDataUrl;
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Verify' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        twoFactorAuthCode: { type: 'string' },
      },
      required: ['twoFactorAuthCode'],
    },
  })
  async verify2FA(
    @Request() req,
    @Body('twoFactorAuthCode') code: string,
  ) {

    const userId = req.user.userId;
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isValid = await this.authService
      .isTwoFactorAuthenticationCodeValid(code, user);

    if (!isValid) {
      throw new BadRequestException('Invalid OTP');
    }

    user.isTwoFactorAuthEnabled = true;
    await user.save();

    return {
      message: '2FA enabled successfully',
      access_token: this.authService.generateJwt(user).access_token };
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
