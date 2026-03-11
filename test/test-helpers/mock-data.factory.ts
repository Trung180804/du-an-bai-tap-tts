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

export const createMockPost = (overrides: any = {}) => ({
  _id: mockPostId,
  title: overrides.title || 'Test Title',
  content: overrides.content || 'Test Content',
  author: overrides.author || mockUserId,
  isDeleted: overrides.isDeleted ?? false,
  likesCount: overrides.likesCount || 0,
  commentsCount: overrides.commentsCount || 0,
  ...overrides,
}),

export const createMockComment = (overrides: any = {}) => ({
  _id: mockCommentId,
  content: overrides.content || 'Nice post!',
  post: overrides.post || mockPostId,
  user: overrides.user || mockUserId,
  ...overrides,
}),

export const createMockMongooseModel = () => {
  const mockModel = function (dto: any) {
    this.data = dto;
    this.save = jest.fn().mockResolvedValue(this.data);
  } as any;

  mockModel.find = jest.fn().mockReturnThis();
  mockModel.findOne = jest.fn().mockReturnThis();
  mockModel.findById = jest.fn().mockReturnThis();
  mockModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockModel.create = jest.fn();
  mockModel.aggregate = jest.fn();
  mockModel.updateMany = jest.fn();
  mockModel.deleteOne = jest.fn();
  mockModel.exec = jest.fn();
  mockModel.select = jest.fn().mockReturnThis();

  return mockModel;
};
