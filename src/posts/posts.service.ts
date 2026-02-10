import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import dayjs from 'dayjs';
import { Post } from './post.schema';
import { Like } from './like.schema';
import { Comment } from './comment.schema';
import { User } from '@/users/user.schema';
import { FeedDto } from './dto/feed.dto';
import { RedisService } from './../redis/redis.service';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import JSZip from 'jszip';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Like.name) private likeModel: Model<Like>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly redisService: RedisService,
  ) {}

  // ====================== POST ======================
  async createPost(
    userId: string,
    content: string,
    title: string,
    imageUrl?: string,
    createdAt?: Date,
    likesCount?: number,
    commentsCount?: number,
  ) {
    const newPost = new this.postModel({
      title: title || 'Trungggg',
      content,
      imageUrl,
      author: new Types.ObjectId(userId),
      createdAt: createdAt || new Date(),
      isDeleted: false,
      likesCount: likesCount || 0,
      commentsCount: commentsCount || 0,
    });
    return newPost.save();
  }

  async updatePost(
    postId: string,
    userId: string,
    content: string,
    title: string,
    imageUrl?: string,
    createdAt?: Date,
  ) {
    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(postId),
      isDeleted: { $ne: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.author.toString() !== userId)
      throw new NotFoundException('You are not the author');

    return this.postModel.findByIdAndUpdate(
      postId,
      { content, title, imageUrl, createdAt },
      { new: true },
    );
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');
    if (post.author.toString() !== userId)
      throw new NotFoundException('You are not the author');

    return this.postModel.findByIdAndUpdate(
      postId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
  }

  // ====================== FEED ======================
  private timeLimit(mode: string): Date {
    if (mode.includes('today')) return dayjs().startOf('day').toDate();
    if (mode.includes('week')) return dayjs().subtract(7, 'day').toDate();
    if (mode.includes('month')) return dayjs().subtract(30, 'day').toDate();
    return new Date(0);
  }

  private getSortCondition(mode: string) {
    switch (mode) {
      case 'newest':
      case 'latest':
        return { createdAt: -1 };
      case 'most_liked':
        return { likesCount: -1, createdAt: -1 };
      case 'recent_interaction':
        return { lastActivity: -1 };
      case 'most_interacted_today':
      case 'most_interacted_week':
      case 'most_interacted_month':
        return { interactionScore: -1, createdAt: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  private buildBasePipeline(userId: string, filter: any, mode: string) {
    return [
      { $match: filter },
      {
        $addFields: {
          interactionScore: { $add: ['$likesCount', '$commentsCount'] },
          lastActivity: { $ifNull: ['$updatedAt', '$createdAt'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorInfo',
        },
      },
      { $unwind: '$authorInfo' },

      {
        $lookup: {
          from: 'comments',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$post', '$$postId'] },
                    { $ne: ['$isDeleted', true] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 2 },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'commenter',
              },
            },
            {
              $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true },
            },
            {
              $project: {
                content: 1,
                createdAt: 1,
                'commenter.name': 1,
                'commenter.avatar': 1,
              },
            },
          ],
          as: 'latestComments',
        },
      },

      {
        $lookup: {
          from: 'likes',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$post', '$$postId'] },
                    { $eq: ['$user', new Types.ObjectId(userId)] },
                  ],
                },
              },
            },
          ],
          as: 'likedData',
        },
      },
      {
        $addFields: {
          isLikedByCurrentUser: { $gt: [{ $size: '$likedData' }, 0] },
        },
      },

      {
        $project: {
          _id: 1,
          title: 1,
          content: 1,
          imageUrl: 1,
          likesCount: 1,
          commentsCount: 1,
          createdAt: 1,
          updatedAt: 1,
          interactionScore: 1,
          lastActivity: 1,
          isLikedByCurrentUser: 1,
          latestComments: 1,

          author: {
            _id: '$authorInfo._id',
            name: '$authorInfo.name',
            avatar: '$authorInfo.avatar',
          },
        },
      },
      { $sort: this.getSortCondition(mode) },
    ];
  }

  async getFeed(userId: string, query: FeedDto) {
    const { mode = 'newest', page: rawPage = 1, limit = 10 } = query;
    let page = Math.max(1, Number(rawPage));
    const skip = (page - 1) * limit;
    const timeLimit = this.timeLimit(mode);
    const filter = { isDeleted: { $ne: true }, createdAt: { $gte: timeLimit } };

    const basePipeline = this.buildBasePipeline(userId, filter, mode);

    const result = await this.postModel.aggregate([
      ...basePipeline,
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      },
    ] as any[]);

    const data = result[0].data;
    const totalItems = result[0].metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);
    if (page > totalPages && (totalItems > 0 || page < 1)) {
      // if you want to go back to the recent page
      return this.getFeed(userId, { ...query, page: totalPages });
      // if you want to error message
      //throw new NotFoundException(`Page ${page} does not exist. Now there are only ${totalPages} pages.`);
    }

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: Number(limit),
        totalPages,
        currentPage: Number(page),
      },
    };
  }

  // ====================== EXPORT ======================
  private buildExportPipeline(filter: any, mode: string) {
    return [
      { $match: filter },
      {
        $addFields: {
          interactionScore: { $add: ['$likesCount', '$commentsCount'] },
          lastActivity: { $ifNull: ['$updatedAt', '$createdAt'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorInfo',
        },
      },
      { $unwind: '$authorInfo' },
      {
        $lookup: {
          from: 'comments',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$post', '$$postId'] },
                    { $ne: ['$isDeleted', true] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 2 },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'commenter',
              },
            },
            {
              $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true },
            },
            {
              $project: {
                content: 1,
                createdAt: 1,
                'commenter.name': 1,
                'commenter.avatar': 1,
              },
            },
          ],
          as: 'latestComments',
        },
      },
      {
        $project: {
          title: 1,
          authorName: '$authorInfo.name',
          authorAvatar: '$authorInfo.avatar',
          likesCount: 1,
          commentsCount: 1,
          createdAt: 1,
          latestComment1: {
            $cond: [
              { $gt: [{ $size: '$latestComments' }, 0] },
              {
                $concat: [
                  { $arrayElemAt: ['$latestComments.commenter.name', 0] },
                  ': ',
                  { $arrayElemAt: ['$latestComments.content', 0] },
                ],
              },
              '',
            ],
          },
          latestComment2: {
            $cond: [
              { $gt: [{ $size: '$latestComments' }, 1] },
              {
                $concat: [
                  { $arrayElemAt: ['$latestComments.commenter.name', 1] },
                  ': ',
                  { $arrayElemAt: ['$latestComments.content', 1] },
                ],
              },
              '',
            ],
          },
        },
      },
      { $sort: this.getSortCondition(mode) },
    ];
  }

  async exportPosts(query: FeedDto, format: 'csv' | 'xlsx' | 'both') {
    const mode = query.mode || 'newest';
    const timeLimit = this.timeLimit(mode);
    const filter = { isDeleted: { $ne: true }, createdAt: { $gte: timeLimit } };

    const pipeline = this.buildExportPipeline(filter, mode);
    const posts = await this.postModel.aggregate(pipeline as any[]);

    const rows = posts.map((p: any) => ({
      Title: p.title,
      Author: p.authorName,
      'Author Avatar': p.authorAvatar || '',
      Likes: p.likesCount,
      Comments: p.commentsCount,
      'Latest Comment 1': p.latestComment1,
      'Latest Comment 2': p.latestComment2,
      'Created At': dayjs(p.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    }));

    if (format === 'csv') return this.generateCsv(rows);
    if (format === 'xlsx') return this.generateXlsx(rows);

    // both → zip
    const zip = new JSZip();
    zip.file('posts.csv', await this.generateCsv(rows));
    zip.file('posts.xlsx', await this.generateXlsx(rows));
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  private async generateCsv(data: any[]) {
    const parser = new Parser();
    return parser.parse(data);
  }

  private async generateXlsx(data: any[]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Posts');
    if (data.length > 0) {
      sheet.columns = Object.keys(data[0]).map((key) => ({ header: key, key }));
      sheet.addRows(data);
      sheet.getRow(1).font = { bold: true };
    }
    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  // ====================== COMMENT ======================
  async addComment(
    postId: string,
    userId: string,
    content: string,
    imageUrl?: string,
  ) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');

    const newComment = await this.commentModel.create({
      content,
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
      ...(imageUrl && { imageUrl }),
      isDeleted: false,
    });

    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 },
    });
    await this.redisService.delCache(`user_commented_posts:${userId}`);

    return newComment;
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string,
    imageUrl?: string,
  ) {
    const comment = await this.commentModel.findOne({
      _id: new Types.ObjectId(commentId),
      user: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!comment)
      throw new NotFoundException(
        'Comment not found or you are not the author',
      );

    const updated = await this.commentModel.findByIdAndUpdate(
      commentId,
      { content, imageUrl, updatedAt: new Date() },
      { new: true },
    );

    await this.redisService.delCache(`user_commented_posts:${userId}`);
    return updated;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.commentModel.findOne({
      _id: new Types.ObjectId(commentId),
      user: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.commentModel.findByIdAndUpdate(commentId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    await this.postModel.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 },
    });

    await this.redisService.delCache(`user_commented_posts:${userId}`);
    return { message: 'Comment deleted successfully' };
  }

  // ====================== LIKE ======================
  async toggleLike(postId: string, userId: string) {
    const existingLike = await this.likeModel.findOne({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
    });

    if (existingLike) {
      await this.likeModel.deleteOne({ _id: existingLike._id });
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { likesCount: -1 },
      });
      await this.redisService.delCache(`user_liked_posts:${userId}`);
      return { liked: false };
    } else {
      await this.likeModel.create({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(userId),
      });
      await this.postModel.findByIdAndUpdate(postId, {
        $inc: { likesCount: 1 },
      });
      await this.redisService.delCache(`user_liked_posts:${userId}`);
      return { liked: true };
    }
  }

  // ====================== USER POSTS ======================
  async getMyLikedPosts(userId: string) {
    const cacheKey = `user_liked_posts:${userId}`;
    const cached = await this.redisService.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.likeModel.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      {
        $lookup: {
          from: 'posts',
          localField: 'post',
          foreignField: '_id',
          as: 'postInfo',
        },
      },
      { $unwind: '$postInfo' },
      { $match: { 'postInfo.isDeleted': { $ne: true } } },
      { $replaceRoot: { newRoot: '$postInfo' } },
    ]);

    await this.redisService.setCache(cacheKey, result, 300);
    return result;
  }

  async getMyCommentedPosts(userId: string) {
    const cacheKey = `user_commented_posts:${userId}`;
    const cached = await this.redisService.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.commentModel.aggregate([
      {
        $match: { user: new Types.ObjectId(userId), isDeleted: { $ne: true } },
      },
      { $group: { _id: '$post', lastCommentedAt: { $max: '$createdAt' } } },
      {
        $lookup: {
          from: 'posts',
          localField: 'post',
          foreignField: '_id',
          as: 'postInfo',
        },
      },
      { $unwind: '$postInfo' },
      { $match: { 'postInfo.isDeleted': { $ne: true } } },
      { $replaceRoot: { newRoot: '$postInfo' } },
      { $sort: { createdAt: -1 } },
    ]);

    await this.redisService.setCache(cacheKey, result, 300);
    return result;
  }

  // ====================== SEED ======================
  async seedData(userId: string) {
    const posts: any[] = [];
    const comments: any[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const dates = [
      new Date(),
      new Date(Date.now() - 3 * dayMs),
      new Date(Date.now() - 10 * dayMs),
      new Date(Date.now() - 45 * dayMs),
    ];
    for (let i = 1; i <= 100; i++) {
      const currentPostId = new Types.ObjectId();
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      const randomLikes = Math.floor(Math.random() * 500);
      const randomComments = Math.floor(Math.random() * 200);
      posts.push({
        _id: currentPostId,
        title: `Post number ${i}`,
        content: `I am Trung and I am number ${i}`,
        author: new Types.ObjectId(userId),
        likesCount: randomLikes,
        commentsCount: randomComments,
        isDeleted: false,
        createdAt: randomDate,
        updatedAt: randomDate,
      });
      for (let j = 1; j <= randomComments; j++) {
        comments.push({
          content: `Comment number ${j} belong to post ${i}`,
          post: currentPostId,
          user: new Types.ObjectId(userId),
          isDeleted: false,
          createdAt: new Date(randomDate.getTime() + j * 1000),
        });
      }
    }
    await this.postModel.insertMany(posts);
    await this.commentModel.insertMany(comments);
    return { message: `----- Congragulations ----` };
  }

  async checkCommentsForPost(postId: string) {
    return this.commentModel.find({ post: new Types.ObjectId(postId) })
      .sort({ createdAt: -1 })
      .limit(2);
  }
}
