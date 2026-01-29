import dayjs from 'dayjs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post } from './post.schema';
import { Like } from './like.schema';
import { Comment } from './comment.schema';
import { User } from '@/users/user.schema';
import { FeedDto } from './dto/feed.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<Post>,
    @InjectModel(Like.name) private likeModel: Model<Like>,
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createPost(userId: string, content: string, title: string, imageUrl?: string) {
    const newPost = new this.postModel({
      title: title || "Trungggg",
      content: content,
      author: new Types.ObjectId(userId),
      imageUrl: imageUrl,
      isDeleted: false,
      likesCount: 0,
      commentsCount: 0,
    });
    return newPost.save();
  }

  async updatePost(postId: string, userId: string, content: string, title: string, imageUrl?: string) {
    console.log("Đang tìm Post với ID:", postId);
    console.log("Của User ID:", userId);
    const post = await this.postModel.findOne({_id: new Types.ObjectId(postId), isDeleted: { $ne: true } });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Do not search post');
    }
    if (post.author.toString() !== userId.toString().trim()) {
      throw new NotFoundException('You are not the author of this post');
    }
    return this.postModel.findByIdAndUpdate(postId, { content, title, imageUrl }, { new: true });
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }
    if (post.author.toString() !== userId.toString().trim()) {
      throw new NotFoundException('Post not found');
    }
    return this.postModel.findByIdAndUpdate(
      postId,
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );
  }

  async getFeed(userId: string, query: FeedDto) {
    const { mode = 'newest', page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    let timeLimit = new Date(0); // default to epoch start
    if (mode === 'most_interacted_today') {
      timeLimit = dayjs().startOf('day').toDate();
    } else if (mode === 'most_interacted_week') {
      timeLimit = dayjs().subtract(7, 'day').toDate();
    } else if (mode === 'most_interacted_month') {
      timeLimit = dayjs().subtract(30, 'day').toDate();
    }

    return this.postModel.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: timeLimit } } },
      {
        $addFields: {
          interactionScore: { $add: ['$likesCount', '$commentsCount'] },
          lastActivity: { $ifNull: ['$updatedAt', '$createdAt'] },
        },
      },
      // info author
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorInfo',
        },
      },
      { $unwind: '$authorInfo' },

      // take new comments
      {
        $lookup: {
          from: 'comments',
          let: { postId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                  { $eq: [{ $toString: '$post' }, { $toString: '$$postId' }] },
                    { $eq: ['$isDeleted', false] },
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
            { $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true } }
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
                    { $eq: ['$user', typeof userId === 'string' ? new Types.ObjectId(userId) : userId] },
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

      { $sort: this.getSortCondition(mode) },
      { $skip: skip },
      { $limit: limit },
      { $project: { likedData: 0 } },
    ]);
  }

  async checkCommentsForPost(postId: string) {
    const comments = await this.commentModel.find({ post: new Types.ObjectId(postId) }).sort({ createdAt: -1 }).limit(2);
    console.log('Comments found:', comments);
    return comments;
  }

  async recountComments(postId: string) {
    const count = await this.commentModel.countDocuments({ post: new Types.ObjectId(postId) }); 
    await this.postModel.findByIdAndUpdate(postId, { commentsCount: count });
    return count;
  }

  async toggleLike(postId: string, userId: string) {
    const existingLike = await this.likeModel.findOne({
      post: new Types.ObjectId(postId),
      user: new Types.ObjectId(userId),
    });

    if (existingLike) {
      await this.likeModel.deleteOne({ _id: existingLike._id });
      await this.postModel.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } });
      return { liked: false };
    } else {
      await this.likeModel.create({
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(userId),
      });
      await this.postModel.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });
      return { liked: true };
    }
  }

  async addComment(postId: string, userId: string, content: string, imageUrl?: string) {
    const post = await this.postModel.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }
    try {
      const newComment = await this.commentModel.create({
        content,
        post: new Types.ObjectId(postId),
        user: new Types.ObjectId(userId),
        ...(imageUrl && { imageUrl }),
        isDeleted: false,
      });
      console.log('Saved new comment:', newComment);
      await this.postModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
      return newComment;
    } catch (error) {
      console.error('Error', error.message, error.stack);
      throw new NotFoundException('Failed to add comment');
    }
  }

  private getSortCondition(mode?: string): any {
    switch (mode) {
      // post newest
      case 'newest':
      case 'latest':
        return { createdAt: -1 };
      // post have much likes
      case 'most_liked':
        return { likesCount: -1, createdAt: -1 };
      // post have recent interaction
      case 'recent_interaction':
        return { lastActivity: -1 };
      // post have much comments
      case 'most_interacted_today':
      case 'most_interacted_week':
      case 'most_interacted_month':
        return { interactionScore: -1, createdAt: -1 };

      default:
        return { createdAt: -1 as const };
    }
  }

  async getMyLikedPosts(userId: string) {
    console.log(" UserID đang truy vấn: ", userId);
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
      { $match: { 'postInfo.isDeleted': false } },
      { $replaceRoot: { newRoot: '$postInfo' } },
    ]);
    console.log("Kết quả tìm được: ", result.length);
    return result;
  }

  async getMyCommentedPosts(userId: string) {
    return this.commentModel.aggregate([
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
      { $match: { 'postInfo.isDeleted': false } },
      {
        $group: {
          _id: '$postInfo._id',
          postData: { $first: '$postInfo' },
        },
      },
      { $replaceRoot: { newRoot: '$postData' } },
    ]);
  }
}
