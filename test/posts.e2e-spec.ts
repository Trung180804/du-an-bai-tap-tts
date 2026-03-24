import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PostsController } from '../src/posts/posts.controller';
import { PostsService } from '../src/posts/posts.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { mockUserId, mockPostId, mockCommentId } from './test-helpers/mock-data.factory';

describe('PostsController (e2e)', () => {
  let app: INestApplication;

  const mockPostsService = {
    getFeed: jest.fn(), createPost: jest.fn(), toggleLike: jest.fn(),
    updatePost: jest.fn(), deletePost: jest.fn(), getMyLikedPosts: jest.fn(),
    getMyCommentedPosts: jest.fn(), seedData: jest.fn(), exportPosts: jest.fn(),
    addComment: jest.fn(), updateComment: jest.fn(), deleteComment: jest.fn(),
    checkCommentsForPost: jest.fn(), cleanupNoInteractionPosts: jest.fn(), createExpiredPost: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: mockPostsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: mockUserId };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => { jest.clearAllMocks(); });
  afterAll(async () => { if (app) await app.close(); });

  describe('GET /posts/feed', () => {
    it('should return paginated feed (200 OK)', async () => {
      const mockFeedData = {
        data: [{ _id: mockPostId, title: 'Test Post', content: 'Hello' }],
        meta: { totalItems: 1, totalPages: 1, currentPage: 1 },
      };
      mockPostsService.getFeed.mockResolvedValue(mockFeedData);

      const response = await request(app.getHttpServer()).get('/posts/feed').query({ page: 1, limit: 5 }).expect(200);
      expect(response.body).toEqual(mockFeedData);
      expect(mockPostsService.getFeed).toHaveBeenCalledWith(mockUserId, { page: '1', limit: '5' });
    });
  });

  describe('POST /posts', () => {
    it('should create a new post (201 Created)', async () => {
      const createDto = { content: 'My first post!', title: 'Welcome' };
      const mockCreatedPost = { _id: mockPostId, ...createDto, author: mockUserId };

      mockPostsService.createPost.mockResolvedValue(mockCreatedPost);

      const response = await request(app.getHttpServer()).post('/posts').send(createDto).expect(201);
      expect(response.body).toEqual(mockCreatedPost);
      expect(mockPostsService.createPost).toHaveBeenCalledWith(mockUserId, createDto.content, createDto.title, undefined, undefined, undefined, undefined);
    });
  });

  describe('PUT /posts/:id', () => {
    it('should update post successfully (200 OK)', async () => {
      const updateDto = { content: 'Updated content', title: 'Updated title' };
      mockPostsService.updatePost.mockResolvedValue({ _id: mockPostId, ...updateDto });

      const response = await request(app.getHttpServer()).put(`/posts/${mockPostId}`).send(updateDto).expect(200);
      expect(response.body.title).toEqual('Updated title');
      expect(mockPostsService.updatePost).toHaveBeenCalledWith(mockPostId, mockUserId, updateDto.content, updateDto.title, undefined);
    });
  });

  describe('POST /posts/:postId/like', () => {
    it('should toggle like successfully (201 Created)', async () => {
      mockPostsService.toggleLike.mockResolvedValue({ liked: true });

      const response = await request(app.getHttpServer()).post(`/posts/${mockPostId}/like`).expect(201);
      expect(response.body).toEqual({ liked: true });
      expect(mockPostsService.toggleLike).toHaveBeenCalledWith(mockPostId, mockUserId);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('should delete post successfully (200 OK)', async () => {
      mockPostsService.deletePost.mockResolvedValue({ message: 'Post deleted' });

      const response = await request(app.getHttpServer()).delete(`/posts/${mockPostId}`).expect(200);
      expect(response.body).toEqual({ message: 'Post deleted' });
      expect(mockPostsService.deletePost).toHaveBeenCalledWith(mockPostId, mockUserId);
    });
  });

  describe('POST /posts/:postId/comment', () => {
    it('should add comment successfully (201 Created)', async () => {
      const commentDto = { content: 'Nice post!' };
      const mockComment = { _id: mockCommentId, ...commentDto, author: mockUserId };

      mockPostsService.addComment.mockResolvedValue(mockComment);

      const response = await request(app.getHttpServer()).post(`/posts/${mockPostId}/comment`).send(commentDto).expect(201);
      expect(response.body).toEqual(mockComment);
      expect(mockPostsService.addComment).toHaveBeenCalledWith(mockPostId, mockUserId, commentDto.content, undefined);
    });
  });

  describe('GET /posts/:id/comments', () => {
    it('should get comments for a post (200 OK)', async () => {
      const mockComments = [{ _id: mockCommentId, content: 'First comment', author: mockUserId }];
      mockPostsService.checkCommentsForPost.mockResolvedValue(mockComments);

      const response = await request(app.getHttpServer()).get(`/posts/${mockPostId}/comments`).expect(200);
      expect(response.body).toEqual(mockComments);
      expect(mockPostsService.checkCommentsForPost).toHaveBeenCalledWith(mockPostId);
    });
  });

  describe('GET /posts/export', () => {
    it('should export data successfully (200 OK)', async () => {
      const mockBuffer = Buffer.from('exported data');
      mockPostsService.exportPosts.mockResolvedValue(mockBuffer);

      const response = await request(app.getHttpServer()).get('/posts/export').query({ format: 'xlsx' }).expect(200);
      expect(response.header['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.header['content-disposition']).toMatch(/attachment; filename="posts_export_\d{8}_\d{4}\.xlsx"/);
      expect(mockPostsService.exportPosts).toHaveBeenCalledWith({}, 'xlsx');
    });
  });

  describe('GET /posts/myLiked', () => {
    it('should return liked posts of user (200 OK)', async () => {
      const mockPosts = [{ _id: mockPostId, title: 'Liked Post' }];
      mockPostsService.getMyLikedPosts.mockResolvedValue(mockPosts);

      const response = await request(app.getHttpServer()).get('/posts/myLiked').expect(200);
      expect(response.body).toEqual(mockPosts);
      expect(mockPostsService.getMyLikedPosts).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('GET /posts/myCommented', () => {
    it('should return commented posts of user (200 OK)', async () => {
      const mockPosts = [{ _id: mockPostId, title: 'Commented Post' }];
      mockPostsService.getMyCommentedPosts.mockResolvedValue(mockPosts);

      const response = await request(app.getHttpServer()).get('/posts/myCommented').expect(200);
      expect(response.body).toEqual(mockPosts);
      expect(mockPostsService.getMyCommentedPosts).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('POST /posts/seed', () => {
    it('should seed data successfully (201 Created)', async () => {
      mockPostsService.seedData.mockResolvedValue({ message: 'Seeding done' });
      const response = await request(app.getHttpServer()).post('/posts/seed').expect(201);
      expect(response.body).toEqual({ message: 'Seeding done' });
      expect(mockPostsService.seedData).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('POST /posts/cleanupPosts', () => {
    it('should trigger manual cleanup successfully (201 Created)', async () => {
      mockPostsService.cleanupNoInteractionPosts.mockResolvedValue(true);
      const response = await request(app.getHttpServer()).post('/posts/cleanupPosts').expect(201);
      expect(response.body).toEqual({ message: 'Manual cleanup triggered successfully' });
      expect(mockPostsService.cleanupNoInteractionPosts).toHaveBeenCalled();
    });
  });

  describe('POST /posts/test-schedule-setup', () => {
    it('should setup test schedule successfully (201 Created)', async () => {
      mockPostsService.createExpiredPost.mockResolvedValue({ _id: mockPostId });
      const response = await request(app.getHttpServer()).post('/posts/test-schedule-setup').expect(201);
      expect(response.body).toEqual({ _id: mockPostId });
      expect(mockPostsService.createExpiredPost).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('PUT /posts/comment/:commentId', () => {
    it('should update comment successfully (200 OK)', async () => {
      const updateDto = { content: 'toi la Trung' };
      mockPostsService.updateComment.mockResolvedValue({ _id: mockCommentId, ...updateDto });

      const response = await request(app.getHttpServer()).put(`/posts/comment/${mockCommentId}`).send(updateDto).expect(200);
      expect(response.body).toEqual({ _id: mockCommentId, ...updateDto });
      expect(mockPostsService.updateComment).toHaveBeenCalledWith(mockCommentId, mockUserId, updateDto.content, undefined);
    });
  });

  describe('DELETE /posts/comment/:commentId', () => {
    it('should delete comment successfully (200 OK)', async () => {
      mockPostsService.deleteComment.mockResolvedValue({ isDeleted: true });
      const response = await request(app.getHttpServer()).delete(`/posts/comment/${mockCommentId}`).expect(200);
      expect(response.body).toEqual({ isDeleted: true });
      expect(mockPostsService.deleteComment).toHaveBeenCalledWith(mockCommentId, mockUserId);
    });
  });
});
