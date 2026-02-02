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

  async createPost(
    userId: string,
    content: string,
    title: string,
    imageUrl?: string,
    createdAt?: Date,
    // Create to test post interaction (day, week, month)
    likesCount?: number,
    commentsCount?: number,
  ) {
    const newPost = new this.postModel({
      title: title || "Trungggg",
      content: content,
      imageUrl: imageUrl,
      author: new Types.ObjectId(userId),
      createdAt: createdAt || new Date(),
      isDeleted: false,
      // Create to test post interaction (day, week, month)
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
    createdAt?: Date) {
    console.log("Đang tìm Post với ID:", postId);
    console.log("Của User ID:", userId);
    const post = await this.postModel.findOne({_id: new Types.ObjectId(postId), isDeleted: { $ne: true } });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Do not search post');
    }
    if (post.author.toString() !== userId.toString().trim()) {
      throw new NotFoundException('You are not the author of this post');
    }
    return this.postModel.findByIdAndUpdate(postId, { content, title, imageUrl, createdAt }, { new: true });
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

    let timeLimit = new Date(0);
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
                    { $eq:['$post','$$postId']},
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
            { $unwind: { path: '$commenter', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                content: 1,
                createdAt: 1,
                "commenter.name": 1,
                "commenter.avatar": 1,
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
      {
        $project: {
          _id: 1, title: 1, content: 1, author: 1, likesCount: 1,
          email: 1, address: 1,
          commentsCount: 1, imageUrl: 1, isDeleted: 1, createdAt: 1,
          updatedAt: 1, interactionScore: 1, lastActivity: 1,
          isLikedByCurrentUser: 1,
          latestComments: 1,

          "authorInfo.avatar": 1,
          "authorInfo.name": 1,
        },
      },
      { $sort: this.getSortCondition(mode) },
      { $skip: skip },
      { $limit: limit },
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
    console.log(" UserID is querying: ", userId);
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
    console.log("Result: ", result.length);
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

  async seedData(userId: string) {
    const posts: any[] = [];
    const comments: any[] = [];
    const day = 24 * 60 * 60 * 1000;
    const dates = [
      new Date(),
      new Date(Date.now() - 3* day),
      new Date(Date.now() - 10* day),
      new Date(Date.now() - 45* day),
    ];

    for (let i = 1; i <= 100; i++) {
      const currentPostId = new Types.ObjectId();
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      posts.push({
        _id: currentPostId,
        title: `Post number ${i}`,
        content: `I am Trung and I am number ${i}`,
        author: new Types.ObjectId(userId),
        likesCount: Math.floor(Math.random() * 500),
        commentsCount: 2,
        /* If you want to display a random number of comments
        commentsCount: Math.floor(Math.random() * 200),
        */
        isDeleted: false,
        createdAt: randomDate,
        updatedAt: randomDate,
      });

      for (let j = 1; j <= 2; j++) {
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
}
