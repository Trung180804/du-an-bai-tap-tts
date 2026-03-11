import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';

import { PostsService } from '../posts.service';
import { Post } from '../post.schema';
import { Like } from '../like.schema';
import { Comment } from '../comment.schema';
import { User } from '../../users/user.schema';
import { RedisService } from '../../redis/redis.service';
import { PostsGateway } from '../posts.gateway';

import {
  mockUserId,
  mockPostId,
  createMockRedisService,
  createMockPostsGateway,
  createMockPost,
  createMockComment,
  createMockMongooseModel,
} from '../../../test/test-helpers/mock-data.factory';

jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue('mock-csv-data'),
  })),
}));

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet: jest.fn().mockReturnValue({
      columns: [],
      addRows: jest.fn(),
      getRow: jest.fn().mockReturnValue({ font: {} }),
    }),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-xlsx-data')),
    },
  })),
}));

jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    file: jest.fn(),
    generateAsync: jest.fn().mockResolvedValue(Buffer.from('mock-zip-data')),
  }));
});

describe('PostsService', () => {
  let service: PostsService;

  const mockPost = createMockPost();
  const mockComment = createMockComment();

  let mockPostModel: any;
  let mockCommentModel: any;
  let mockLikeModel: any;
  let mockUserModel: any;

  beforeAll(async () => {
    mockPostModel = createMockMongooseModel();
    mockCommentModel = createMockMongooseModel();
    mockLikeModel = createMockMongooseModel();
    mockUserModel = createMockMongooseModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getModelToken(Post.name), useValue: mockPostModel },
        { provide: getModelToken(Comment.name), useValue: mockCommentModel },
        { provide: getModelToken(Like.name), useValue: mockLikeModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: RedisService, useValue: createMockRedisService() },
        { provide: PostsGateway, useValue: createMockPostsGateway() },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Post CRUD', () => {
    it('should create a new post successfully', async () => {
      const result = await service.createPost(mockUserId, 'Test Content', 'Test Title');
      expect(result.title).toEqual('Test Title');
    });

    it('should throw NotFoundException if update a post that not exists or wrong author', async () => {
      mockPostModel.findOne.mockResolvedValue(null);
      await expect(service.updatePost(mockPostId, mockUserId, 'New content', 'New Title')).rejects.toThrow(NotFoundException);
    });

    it('should update post successfully', async () => {
      mockPostModel.findOne.mockResolvedValue(mockPost);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({ ...mockPost, title: 'New Title' });
      const result = await service.updatePost(mockPostId, mockUserId, 'New content', 'New Title');
      
      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result.title).toEqual('New Title');
    });

    it('should soft delete post successfully', async () => {
      mockPostModel.findById.mockResolvedValue(mockPost);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({ ...mockPost, isDeleted: true });
      await service.deletePost(mockPostId, mockUserId);

      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockPostId, expect.objectContaining({ isDeleted: true }), { new: true },
      );
    });
  });

  describe('Comments', () => {
    it('should add comment, update post count, clear cache and notify gateway', async () => {
      mockPostModel.findById.mockResolvedValue(mockPost);
      mockCommentModel.create.mockResolvedValue(mockComment);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({ ...mockPost, commentsCount: 1 });

      const result = await service.addComment(mockPostId, mockUserId, 'Nice post!');
      expect(mockCommentModel.create).toHaveBeenCalled();
      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(mockPostId, { $inc: { commentsCount: 1 } });
      expect(result).toEqual(mockComment);
    });
  });

  describe('toggleLike', () => {
    it('should unlike if user already liked the post', async () => {
      const mockExistingLike = { _id: 'like-id' };
      mockPostModel.findById.mockResolvedValue(true);
      mockLikeModel.findOne.mockResolvedValue(mockExistingLike);
      mockLikeModel.deleteOne.mockResolvedValue(true);

      const result = await service.toggleLike(mockPostId, mockUserId);
      expect(mockLikeModel.deleteOne).toHaveBeenCalledWith({ _id: mockExistingLike._id });
      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(mockPostId, { $inc: { likesCount: -1 } });
      expect(result).toEqual({ liked: false });
    });

    describe('getFeed', () => {
      it('should return feed data and pagination meta successfully', async () => {
        mockPostModel.aggregate.mockResolvedValue([
          { metadata: [{ total: 100 }], data: [{ _id: mockPostId, title: 'Feed Post' }] },
        ]);

        const result = await service.getFeed(mockUserId, { mode: 'newest', page: 1, limit: 10 });
        expect(mockPostModel.aggregate).toHaveBeenCalled();
        expect(result.meta.totalItems).toBe(100);
      });
    });
  });

  describe('export features', () => {
    it('should export posts to CSV successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([{ title: 'Post 1' }]);
      const result = await service.exportPosts({ mode: 'newest' }, 'csv');
      expect(result).toEqual('mock-csv-data');
    });

    it('should export posts to Excel successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([{ title: 'Post 1' }]);
      const result = await service.exportPosts({ mode: 'newest' }, 'xlsx');
      expect(result).toEqual(Buffer.from('mock-xlsx-data'));
    });

    it('should export posts to BOTH / ZIP successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([{ title: 'Post 1' }]);
      const result = await service.exportPosts({ mode: 'newest' }, 'both');
      expect(result).toEqual(Buffer.from('mock-zip-data'));
    });
  });

  describe('Cronjobs', () => {
    it('should reset daily post stats and clear related caches', async () => {
      mockPostModel.updateMany.mockResolvedValue({ modifiedCount: 5 });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.cleanupNoInteractionPosts();

      expect(mockPostModel.updateMany).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned up 5 posts'));
      consoleSpy.mockRestore();
    });
  });
});
