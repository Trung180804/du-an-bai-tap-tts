import { Controller, Post, Body, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRegisterDto } from './dto/authRegister.dto';
import { AuthForgotPasswordDTO } from './dto/authForgotPassword.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthLoginDto } from './dto/authLogin.dto';
import { UsersService } from '@/users/users.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private usersService: UsersService,) {}

  @Post('register')
  @ApiOperation({ summary: 'Register' })
  @ApiBody({ type: AuthRegisterDto })
  async register(@Body() registerDto: AuthRegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  async login(@Body() loginDto: AuthLoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email or password is false');
    }

    if(!user.twoFactorAuthSecret) {
      return {
        message: 'Please enter 2FA setup',
        require2FASetup: true,
        userId: user._id,
      };
    }

    if (user.isTwoFactorAuthEnabled) {
      return {
        message: 'Please enter OTP code',
        requires2FA: true,
        userId: user._id,
      };
    }
    return this.authService.login(user.email, loginDto.password);
  }

  @Post('2fa/authenticate')
  @ApiOperation({ summary: ' 2FA OTP CODE ' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'ID' },
        twoFactorAuthCode: { type: 'string', description: 'Code' }
      },
      required: ['userId', 'twoFactorAuthCode']
    },
  })
  @Post('2fa/authenticate')
  async authenticate2FA(
    @Body() data: { userId: string; twoFactorAuthCode: string },
  ) {
    const authUser = await this.usersService.findOne(data.userId);
    if (!authUser) {
      throw new BadRequestException('User does not exist.');
    }

    const isCodeValid =
      await this.authService.isTwoFactorAuthenticationCodeValid(
        data.twoFactorAuthCode,
        authUser,
      );

    if (!isCodeValid) {
      throw new BadRequestException('2FA code is false');
    }

    return this.authService.generateJwt(authUser);
  }

  @Post('2fa/setup')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
      required: ['userId'],
    },
  })
  async setup2FA(@Body('userId') userId: string) {
    const setupUser = await this.usersService.findOne(userId);
    if (!setupUser) {
      throw new BadRequestException('User not found');
    }

    const { secret, otpauthUrl } =
      await this.authService.GenerateTwoFactorAuthenticationSecret(setupUser);

    return { secret, otpauthUrl };
  }

  @Post('2fa/verify')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        twoFactorAuthCode: { type: 'string' },
      },
      required: ['userId', 'twoFactorAuthCode'],
    },
  })
  async verify2FA(
    @Body('userId') userId: string,
    @Body('twoFactorAuthCode') code: string,
  ) {
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

    return { message: '2FA enabled successfully' };
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
