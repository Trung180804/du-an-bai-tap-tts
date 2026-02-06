import { Controller, Post, Body, Param, Put, Delete, Get, Query, UseGuards, Req } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FeedDto } from './dto/feed.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async create(@Req() req, @Body() body: { content: string; title: string; imageUrl?: string; createdAt?: Date;
    likesCount?: number;
    commentsCount?: number }) {
    return this.postsService.createPost(req.user.userId,
      body.content,
      body.title,
      body.imageUrl,
      body.createdAt,
      body.likesCount,
      body.commentsCount,
    );
  }

  @Get('feed')
  async getFeed(@Req() req, @Query() query: FeedDto) {
    return this.postsService.getFeed(req.user.userId, query);
  }

  @Get('myLiked')
  async getMyLiked(@Req() req) {
    return this.postsService.getMyLikedPosts(req.user.userId);
  }

  @Get('myCommented')
  async getMyCommented(@Req() req) {
    return this.postsService.getMyCommentedPosts(req.user.userId);
  }

  @Post('seed')
  async seed(@Req() req) {
    return this.postsService.seedData(req.user.userId);
  }

  @Put(':id')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { content: string; title?: string; imageUrl?: string },
  ) {
    return this.postsService.updatePost(id, req.user.userId, body.content, body.title || '', body.imageUrl);
  }

  @Delete(':id')
  async delete(@Req() req, @Param('id') id: string) {
    return this.postsService.deletePost(id, req.user.userId);
  }

  @Post(':postId/like')
  async toggleLike(@Req() req, @Param('postId') postId: string) {
    return this.postsService.toggleLike(postId, req.user.userId);
  }

  @Post(':postId/comment')
  async addComment(
    @Req() req,
    @Param('postId') postId: string,
    @Body() body: { content: string; imageUrl?: string },
  ) {
    return this.postsService.addComment(postId, req.user.userId, body.content, body.imageUrl);
  }

  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    return this.postsService.checkCommentsForPost(id);
  }
  /* --use debug/fix two comment latest--
  @Post(':id/recount-comments')
  async recount(@Param('id') id: string) {
    return this.postsService.recountComments(id);
  }
    */
}
