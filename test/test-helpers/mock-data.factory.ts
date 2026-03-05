import { Types } from 'mongoose';

export const mockUserId = new Types.ObjectId().toHexString();
export const mockPostId = new Types.ObjectId().toHexString();
export const mockCommentId = new Types.ObjectId().toHexString();

export const createMockRedisService = () => ({
  delCache: jest.fn(),
  getCache: jest.fn(),
  setCache: jest.fn(),
});

export const createMockPostsGateway = () => ({
  notifyNewComment: jest.fn(),
});

export const createMockAuthUser = (data: any = {}) => ({
  _id: '123',
  email: data.email || 'test@gmail.com',
  password: data.password || 'hashed-password',
  name: data.name || 'Trung',
  isTwoFactorAuthEnabled: data.isTwoFactorAuthEnabled ?? false,
  twoFactorAuthSecret: 'secret123',
  save: jest.fn().mockResolvedValue({ _id: '123', ...data }),
  toObject: jest.fn().mockReturnThis(),
});
