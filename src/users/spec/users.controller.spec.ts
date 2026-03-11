import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { MinioService } from '../../minio/minio.service';
import { ForbiddenException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/updateUser.dto';
import { mockUserId, createMockAuthUser } from '../../../test/test-helpers/mock-data.factory';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockMinioService = {
    upLoadFile: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('should throw ForbiddenException if 2FA is pending', async () => {
      const mockReq = { user: { userId: mockUserId, isTwoFactorPending: true } };
      const dto = new UpdateUserDto();

      await expect(
        controller.updateProfile(mockReq, undefined as any, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upload file and update profile with avatar URL', async () => {
      const mockReq = { user: { userId: mockUserId, isTwoFactorPending: false } };
      const dto: UpdateUserDto = { name: 'Trung' };

      const mockFile = {
        originalname: 'avatar.png',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;
      const mockAvatarUrl = 'https://minio.local/avatar.png';

      mockMinioService.upLoadFile.mockResolvedValue(mockAvatarUrl);
      mockUsersService.updateProfile.mockResolvedValue({
        id: mockUserId,
        name: 'Trung',
        avatar: mockAvatarUrl,
      });

      const result = await controller.updateProfile(mockReq, mockFile, dto);

      expect(mockMinioService.upLoadFile).toHaveBeenCalledWith(mockFile);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(mockUserId, {
        name: 'Trung',
        avatar: mockAvatarUrl,
      });
      expect(result.avatar).toEqual(mockAvatarUrl);
    });

    it('should update profile without calling minio if no file is provided', async () => {
      const mockReq = { user: { userId: mockUserId, isTwoFactorPending: false } };
      const dto: UpdateUserDto = { name: 'Trung' };

      mockUsersService.updateProfile.mockResolvedValue({
        id: mockUserId,
        name: 'Trung',
      });

      await controller.updateProfile(mockReq, undefined as any, dto);

      expect(mockMinioService.upLoadFile).not.toHaveBeenCalled();
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(mockUserId, {
        name: 'Trung',
      });
    });
  });

  describe('getProfile', () => {
    it('should throw ForbiddenException if 2FA is pending', async () => {
      const req = { user: { userId: mockUserId, isTwoFactorPending: true } };
      await expect(controller.getProfile(req)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is not found in database', async () => {
      const req = { user: { userId: mockUserId, isTwoFactorPending: false } };
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(controller.getProfile(req)).rejects.toThrow(ForbiddenException);
    });

    it('should return user profile with password and secret 2FA filtered out', async () => {
      const req = { user: { userId: mockUserId, isTwoFactorPending: false } };
      const mockUser = createMockAuthUser({ name: 'Trung' });

      mockUser.toObject.mockReturnValue({
        password: 'abc123',
        twoFactorAuthSecret: 'secret-xyz',
        email: 'test@gmail.com',
        name: 'Trung',
      });

      mockUsersService.findOne.mockResolvedValue(mockUser);
      const result = await controller.getProfile(req);

      expect(mockUsersService.findOne).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({
        email: 'test@gmail.com',
        name: 'Trung',
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('twoFactorAuthSecret');
    });
  });
});
