import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../user.schema';
import { createMockMongooseModel } from '../../../test/test-helpers/mock-data.factory';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: any;

  beforeAll(async () => {
    mockUserModel = createMockMongooseModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const email = 'trung@gmail.com';
      const password = 'hashedPassword';

      const result = await service.create(email, password);

      expect(result).toHaveProperty('email', email);
      expect(result).toHaveProperty('password', password);
    });
  });

  describe('findOneByEmailWithPassword', () => {
    it('should find user by email and select password', async () => {
      const mockUser = { email: 'trung@gmail.com', password: '123' };
      mockUserModel.exec.mockResolvedValueOnce(mockUser);
      const result = await service.findOneByEmailWithPassword('trung@gmail.com');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'trung@gmail.com' });
      expect(mockUserModel.select).toHaveBeenCalledWith('+password');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUpdatedUser = { _id: '1', name: 'New Name' };
      mockUserModel.exec.mockResolvedValueOnce(mockUpdatedUser);

      const result = await service.updateProfile('1', { name: 'New Name' });

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '1',
        { name: 'New Name' },
        { new: true },
      );
      expect(result).toEqual(mockUpdatedUser);
    });
  });
});
