import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../user.schema';

describe('UsersService', () => {
  let service: UsersService;

  // Tạo ra các hàm giả để hứng kết quả của .exec() và .select()
  const mockExec = jest.fn();
  const mockSelect = jest.fn().mockReturnValue({ exec: mockExec });

  // Đây là cách mock một Mongoose Model hoàn chỉnh
  const mockUserModel = function (dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue(this.data);
  };
  mockUserModel.find = jest.fn().mockReturnValue({ exec: mockExec });
  mockUserModel.findById = jest.fn().mockReturnValue({ exec: mockExec });
  mockUserModel.findOne = jest.fn().mockReturnValue({ select: mockSelect, exec: mockExec });
  mockUserModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: mockExec });

  beforeEach(async () => {
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
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const email = 'test@example.com';
      const password = 'hashedPassword';

      const result = await service.create(email, password);

      expect(result).toHaveProperty('email', email);
      expect(result).toHaveProperty('password', password);
    });
  });

  describe('findOneByEmailWithPassword', () => {
    it('should find user by email and select password', async () => {
      const mockUser = { email: 'test@example.com', password: '123' };
      mockExec.mockResolvedValueOnce(mockUser);

      const result = await service.findOneByEmailWithPassword('test@example.com');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockSelect).toHaveBeenCalledWith('+password');
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUpdatedUser = { _id: '1', name: 'New Name' };
      mockExec.mockResolvedValueOnce(mockUpdatedUser);

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