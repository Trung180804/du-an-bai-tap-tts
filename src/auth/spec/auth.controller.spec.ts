import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthRegisterDto } from '../dto/authRegister.dto';
import { AuthLoginDto } from '../dto/authLogin.dto';
import { ChangePasswordDto } from '../dto/changePassword.dto';
import { TwoFactorAuthDto } from '../dto/twoFactorAuth.dto';
import { AuthForgotPasswordDTO } from '../dto/authForgotPassword.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  console.log('DEBUG IMPORTS:', { 
    AuthController, 
    AuthService, 
    UsersService, 
    JwtAuthGuard 
  });

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    enable2FA: jest.fn(),
    setup2FA: jest.fn(),
    verify2FA: jest.fn(),
    disable2FA: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
  };

  const mockUsersService = {findOne: jest.fn()}; // UsersService được inject nhưng không dùng trong controller

  const mockReq = {
    user: { userId: '123', isTwoFactorPending: false },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService }, // ← FIX CHÍNH Ở ĐÂY
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  // ==================== PUBLIC ROUTES ====================
  describe('register', () => {
    it('should call register service', async () => {
      const dto: AuthRegisterDto = { email: 'new@gmail.com', password: '123456' } as any;
      mockAuthService.register.mockResolvedValue({ email: 'new@gmail.com' });

      const result = await controller.register(dto);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result.email).toBe('new@gmail.com');
    });
  });

  describe('login', () => {
    it('should call login service', async () => {
      const dto: AuthLoginDto = { email: 'test@gmail.com', password: '123456' };
      mockAuthService.login.mockResolvedValue({ access_token: 'mock-token' });

      const result = await controller.login(dto);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto.email, dto.password);
      expect(result).toHaveProperty('access_token');
    });
  });

  describe('forgotPassword', () => {
    it('should call forgotPassword service', async () => {
      const dto: AuthForgotPasswordDTO = { email: 'test@gmail.com' };
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'OK' });

      const result = await controller.forgotPassword(dto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toBeDefined();
    });
  });

  // ==================== PROTECTED ROUTES ====================
  describe('2FA routes', () => {
    it('setup2FA should call service', async () => {
      mockUsersService.findOne.mockResolvedValue({ _id: '123', email: 'test@mail.com' });
      mockAuthService.setup2FA.mockResolvedValue('data:image/png;base64,...');
      const result = await controller.setup2FA(mockReq);
      expect(mockAuthService.setup2FA).toHaveBeenCalledWith('123');
      expect(result).toContain('data:image');
    });

    it('enable2FA should call service', async () => {
      mockAuthService.enable2FA.mockResolvedValue({ message: '2FA enabled successfully' });
      const result = await controller.enable2FA(mockReq, '123456');
      expect(mockAuthService.enable2FA).toHaveBeenCalledWith('123', '123456');
      expect(result.message).toBe('2FA enabled successfully');
    });

    it('verify2FA should call service', async () => {
      mockAuthService.verify2FA.mockResolvedValue({ access_token: 'mock-token' });
      const result = await controller.verify2FA(mockReq, '123456');
      expect(mockAuthService.verify2FA).toHaveBeenCalledWith('123', '123456');
      expect(result).toHaveProperty('access_token');
    });

    it('disable2FA should call service', async () => {
      const dto: TwoFactorAuthDto = { twoFactorAuthenticationCode: '123456' };
      mockAuthService.disable2FA.mockResolvedValue({ message: '2FA disabled successfully' });
      const result = await controller.disable2FA(mockReq, dto);
      expect(mockAuthService.disable2FA).toHaveBeenCalledWith('123', '123456');
      expect(result.message).toBe('2FA disabled successfully');
    });
  });

  describe('changePassword', () => {
    it('should call changePassword service', async () => {
      const dto: ChangePasswordDto = { oldPassword: '123', newPassword: 'new123' } as any;
      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed successfully' });
      const result = await controller.changePassword(mockReq, dto);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('123', dto);
      expect(result.message).toBe('Password changed successfully');
    });
  });

  // ==================== ERROR CASES ====================
  describe('error cases', () => {
    it('setup2FA should throw Forbidden when 2FA pending', async () => {
      const pendingReq = { user: { isTwoFactorPending: true } } as any;
      await expect(controller.setup2FA(pendingReq)).rejects.toThrow(ForbiddenException);
    });

    it('disable2FA should throw if no code', async () => {
      const dto = {} as TwoFactorAuthDto;
      await expect(controller.disable2FA(mockReq, dto)).rejects.toThrow(BadRequestException);
    });
  });
});
