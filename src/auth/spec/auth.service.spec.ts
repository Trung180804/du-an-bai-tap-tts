import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bull';
import { QueueName } from '@/common/enums/queue.enum';
import { UsersService } from '@/users/users.service';
import { MailService } from '@/mail/mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@/users/entities/user.entity';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt');
jest.mock('otplib');
jest.mock('qrcode');

import * as bcrypt from 'bcrypt';
import { generateSecret, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let userModel: any;
  let mailQueue: any;
  let mailerService: any;

  const createMockUser = (data: any = {}) => ({
    _id: '123',
    email: data.email || 'test@gmail.com',
    password: data.password || 'hashed-password',
    isTwoFactorAuthEnabled: data.isTwoFactorAuthEnabled ?? false,
    twoFactorAuthSecret: 'secret123',
    save: jest.fn().mockResolvedValue({ _id: '123', ...data }),
    toObject: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    const userModelMock = jest.fn((data) => createMockUser(data));
    userModelMock.findOne = jest.fn();
    userModelMock.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(createMockUser()),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModelMock },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            signAsync: jest.fn().mockResolvedValue('mock-temporary-token'),
          },
        },
        { provide: MailerService, useValue: { sendMail: jest.fn() } },
        { provide: getQueueToken(QueueName.MAIL_QUEUE), useValue: { add: jest.fn() } },
        {
          provide: UsersService,
          useValue: {
            findOneByEmailWithPassword: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        { provide: MailService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    userModel = module.get(getModelToken(User.name));
    mailQueue = module.get(getQueueToken(QueueName.MAIL_QUEUE));
    mailerService = module.get(MailerService);

    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockReset();
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
    (generateSecret as jest.Mock).mockReturnValue('new-secret-123');
    (verify as jest.Mock).mockReturnValue(true);
    (generateURI as jest.Mock).mockReturnValue('otpauth://...');
    (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,...');

    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  // ==================== REGISTER ====================
  describe('register', () => {
    it('should register successfully and push welcome email to queue', async () => {
      userModel.findOne.mockResolvedValue(null);
      const dto = { email: 'new@gmail.com', password: '123456', name: 'Trung' };

      const result = await service.register(dto as any);

      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'new@gmail.com' });
      expect(mailQueue.add).toHaveBeenCalled();
      expect(result.email).toBe('new@gmail.com');
      expect(result.name).toBe('Trung');
    });

    it('should throw if email already exists', async () => {
      userModel.findOne.mockResolvedValue({ email: 'exists@gmail.com' });
      await expect(service.register({ email: 'exists@gmail.com', password: '123' } as any))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ==================== LOGIN ====================
  describe('login', () => {
    it('should return access_token when login successful (no 2FA)', async () => {
      usersService.findOneByEmailWithPassword.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@gmail.com', '123456');
      expect(result).toHaveProperty('access_token');
    });

    it('should return 2FA_REQUIRED when 2FA is enabled', async () => {
      const twoFaUser = createMockUser({ isTwoFactorAuthEnabled: true });
      usersService.findOneByEmailWithPassword.mockResolvedValue(twoFaUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@gmail.com', '123456');
      expect(result.message).toBe('2FA_REQUIRED');
      expect(result.temporary_token).toBe('mock-temporary-token');
    });

    it('should throw UnauthorizedException when wrong password', async () => {
      usersService.findOneByEmailWithPassword.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login('test@gmail.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ==================== 2FA ====================
  describe('2FA', () => {
    it('setup2FA should return QR code', async () => {
      const result = await service.setup2FA('123');
      expect(result).toContain('data:image');
    });

    it('enable2FA should success with valid OTP', async () => {
      const result = await service.enable2FA('123', '123456');
      expect(result.message).toBe('2FA enabled successfully');
    });

    it('verify2FA should return access_token', async () => {
      const result = await service.verify2FA('123', '123456');
      expect(result).toHaveProperty('access_token');
    });

    it('disable2FA should success', async () => {
      userModel.findById.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue(createMockUser({ isTwoFactorAuthEnabled: true })),
      });
      const result = await service.disable2FA('123', '123456');
      expect(result.message).toBe('2FA disabled successfully');
    });
  });

  // ==================== CHANGE PASSWORD & FORGOT PASSWORD ====================
  describe('changePassword & forgotPassword', () => {
    it('changePassword should success', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const dto = { oldPassword: '123456', newPassword: 'newpass123' } as any;
      const result = await service.changePassword('123', dto);
      expect(result.message).toBe('Password changed successfully');
    });

    it('forgotPassword should send OTP', async () => {
      userModel.findOne.mockResolvedValue(createMockUser());
      const result = await service.forgotPassword('test@gmail.com');
      expect(mailerService.sendMail).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
