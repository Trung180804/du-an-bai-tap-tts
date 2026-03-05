import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { MinioService } from 'src/minio/minio.service';
import { ForbiddenException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/updateUser.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let minioService: MinioService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockMinioService = {
    upLoadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    minioService = module.get<MinioService>(MinioService);

    jest.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('should throw ForbiddenException if 2FA is pending', async () => {
      const mockReq = { user: { userId: '1', isTwoFactorPending: true } };
      const dto = new UpdateUserDto();

      await expect(
        controller.updateProfile(mockReq, undefined, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upload file and update profile with avatar URL', async () => {
      const mockReq = { user: { userId: '1', isTwoFactorPending: false } };
      const dto: UpdateUserDto = { name: 'Trung' };

      const mockFile = {
        originalname: 'avatar.png',
        buffer: Buffer.from('img'),
      } as Express.Multer.File;
      const mockAvatarUrl = 'https://minio.local/avatar.png';

      mockMinioService.upLoadFile.mockResolvedValue(mockAvatarUrl);
      mockUsersService.updateProfile.mockResolvedValue({
        id: '1',
        name: 'Trung',
        avatar: mockAvatarUrl,
      });

      const result = await controller.updateProfile(mockReq, mockFile, dto);

      expect(minioService.upLoadFile).toHaveBeenCalledWith(mockFile);
      expect(usersService.updateProfile).toHaveBeenCalledWith('1', {
        name: 'Trung',
        avatar: mockAvatarUrl,
      });
      expect(result.avatar).toEqual(mockAvatarUrl);
    });

    it('should update profile without calling minio if no file is provided', async () => {
      const mockReq = { user: { userId: '1', isTwoFactorPending: false } };
      const dto: UpdateUserDto = { name: 'Trung' };

      mockUsersService.updateProfile.mockResolvedValue({
        id: '1',
        name: 'Trung',
      });

      await controller.updateProfile(mockReq, undefined, dto);

      expect(minioService.upLoadFile).not.toHaveBeenCalled();
      expect(usersService.updateProfile).toHaveBeenCalledWith('1', {
        name: 'Trung',
      });
    });
  });

  describe('getProfile', () => {
    it('should throw ForbiddenException if 2FA is pending', async () => {
      const req = { user: { userId: '123', isTwoFactorPending: true } };

      await expect(controller.getProfile(req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is not found in database', async () => {
      const req = { user: { userId: '123', isTwoFactorPending: false } };
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(controller.getProfile(req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return user profile with password and secret 2FA filtered out', async () => {
      const req = { user: { userId: '123', isTwoFactorPending: false } };

      const mockUser = {
        toObject: jest.fn().mockReturnValue({
          password: 'abc123',
          twoFactorAuthSecret: 'secret-xyz',
          email: 'test@gmail.com',
          name: 'Dinh Van Trung',
        }),
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile(req);

      expect(usersService.findOne).toHaveBeenCalledWith('123');

      expect(result).toEqual({
        email: 'test@gmail.com',
        name: 'Dinh Van Trung',
      });
      expect(result).not.toHaveProperty('password');
    });
  });
});
