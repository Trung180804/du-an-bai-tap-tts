import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { PostsService } from '../posts.service';
import { Post } from '../post.schema';
import { Like } from '../like.schema';
import { Comment } from '../comment.schema';
import { User } from '../../users/user.schema';
import { RedisService } from '../../redis/redis.service';
import { PostsGateway } from '../posts.gateway';
import { title } from 'process';
import e from 'express';

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

  const mockUserId = new Types.ObjectId().toHexString();
  const mockPostId = new Types.ObjectId().toHexString();
  const mockCommentId = new Types.ObjectId().toHexString();

  const mockPost = {
    _id: mockPostId,
    title: 'Test Title',
    content: 'Test Content',
    author: mockUserId,
    isDeleted: false,
    save: jest.fn().mockResolvedValue(this),
  };

  const mockComment = {
    _id: mockCommentId,
    content: 'Nice post!',
    post: mockPostId,
    user: mockUserId,
  };

  const mockPostModel = {
    new: jest.fn().mockResolvedValue(mockPost),
    constructor: jest.fn().mockResolvedValue(mockPost),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    aggregate: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockCommentModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockLikeModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const mockUserModel = {};

  const mockRedisService = {
    delCache: jest.fn(),
    getCache: jest.fn(),
    setCache: jest.fn(),
  };

  const mockPostsGateway = {
    notifyNewComment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getModelToken(Post.name), useValue: mockPostModel },
        { provide: getModelToken(Comment.name), useValue: mockCommentModel },
        { provide: getModelToken(Like.name), useValue: mockLikeModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: RedisService, useValue: mockRedisService },
        { provide: PostsGateway, useValue: mockPostsGateway },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ====================== POST CRUD TESTS ======================
  describe('Post CRUD', () => {
    it('should throw NotFoundException if update a post that not exists or wrong author', async () => {
      mockPostModel.findOne.mockResolvedValue(null);

      await expect(
        service.updatePost(mockPostId, mockUserId, 'New content', 'New Title'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update post successfully', async () => {
      mockPostModel.findOne.mockResolvedValue(mockPost);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({
        ...mockPost,
        title: 'New Title',
      });

      const result = await service.updatePost(
        mockPostId,
        mockUserId,
        'New content',
        'New Title',
      );

      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result.title).toEqual('New Title');
    });

    it('should soft delete post successfully', async () => {
      mockPostModel.findById.mockResolvedValue(mockPost);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({
        ...mockPost,
        isDeleted: true,
      });

      await service.deletePost(mockPostId, mockUserId);

      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockPostId,
        expect.objectContaining({ isDeleted: true }),
        { new: true },
      );
    });
  });

  // ====================== COMMENT TESTS ======================
  describe('Comments', () => {
    it('should add comment, update post count, clear cache and notify gateway', async () => {
      mockPostModel.findById.mockResolvedValue(mockPost);
      mockCommentModel.create.mockResolvedValue(mockComment);
      mockPostModel.findByIdAndUpdate.mockResolvedValue({
        ...mockPost,
        commentsCount: mockPost.commentsCount + 1,
      });

      const result = await service.addComment(
        mockPostId,
        mockUserId,
        'Nice post!',
      );

      expect(mockCommentModel.create).toHaveBeenCalled();

      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(mockPostId, {
        $inc: { commentsCount: 1 },
      });

      expect(mockRedisService.delCache).toHaveBeenCalledWith(
        `user_commented_posts:${mockUserId}`,
      );

      expect(mockPostsGateway.notifyNewComment).toHaveBeenCalledWith(
        mockPostId,
        mockComment,
      );

      expect(result).toEqual(mockComment);
    });
  });

  describe('toggleLike', () => {
    it('should unlike if user already liked the post', async () => {
      const mockExxistingLike = { _id: 'like-id' };
      mockPostModel.findById.mockResolvedValue(true);
      mockLikeModel.findOne.mockResolvedValue(mockExxistingLike);
      mockLikeModel.deleteOne.mockResolvedValue(true);

      const result = await service.toggleLike(mockPostId, mockUserId);

      expect(mockLikeModel.deleteOne).toHaveBeenCalledWith({
        _id: mockExxistingLike._id,
      });
      expect(mockPostModel.findByIdAndUpdate).toHaveBeenCalledWith(mockPostId, {
        $inc: { likesCount: -1 },
      });

      expect(mockRedisService.delCache).toHaveBeenCalledWith(
        `user_liked_posts:${mockUserId}`,
      );
      expect(result).toEqual({ liked: false });
    });

    describe('getFeed', () => {
      it('should return feed data and pagination meta successfully', async () => {
        const mockAggregateResult = [
          {
            metadata: [{ total: 100 }],
            data: [{ _id: mockPostId, title: 'Feed Post' }],
          },
        ];
        mockPostModel.aggregate.mockResolvedValue(mockAggregateResult);

        const query = { mode: 'newest', page: 1, limit: 10 };
        const result = await service.getFeed(mockUserId, query);

        expect(mockPostModel.aggregate).toHaveBeenCalled();
        expect(result.data).toHaveLength(1);
        expect(result.meta.totalItems).toBe(100);
        expect(result.meta.totalPages).toBe(10);
      });
    });
  });

  // ====================== EXPORT TESTS ======================
  describe('export features', () => {
    it('should export posts to CSV successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([
        { title: 'Post 1', content: 'Content 1', likesCount: 5, commentsCount: 2 },
        { title: 'Post 2', content: 'Content 2', likesCount: 0, commentsCount: 0 },
      ]);

      const result = await service.exportPosts({mode: 'newest'}, 'csv');

      expect(mockPostModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual('mock-csv-data');
    });

    it('should export posts to Excel successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([
        { title: 'Post 1', content: 'Content 1', likesCount: 5, commentsCount: 2 },
        { title: 'Post 2', content: 'Content 2', likesCount: 0, commentsCount: 0 },
      ]);

      const result = await service.exportPosts({mode: 'newest'}, 'xlsx');

      expect(mockPostModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('mock-xlsx-data'));
    });

    it('should export posts to BOTH / ZIP successfully', async () => {
      mockPostModel.aggregate.mockResolvedValue([
        { title: 'Post 1', content: 'Content 1', likesCount: 5, commentsCount: 2 },
        { title: 'Post 2', content: 'Content 2', likesCount: 0, commentsCount: 0 },
      ]);

      const result = await service.exportPosts({mode: 'newest'}, 'both');

      expect(mockPostModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('mock-zip-data'));
    });
  });

  describe('Cronjobs', () => {
    it('should reset daily post stats and clear related caches', async () => {
      mockPostModel.updateMany.mockResolvedValue({ modifiedCount: 5 });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.cleanupNoInteractionPosts();

      expect(mockPostModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          likesCount: 0,
          commentsCount: 0,
          isDeleted: false,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ isDeleted: true })
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up 5 posts'),
      );

      consoleSpy.mockRestore();
    });
  });
});
