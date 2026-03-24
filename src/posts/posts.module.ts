import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './post.schema';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Comment, CommentSchema } from './comment.schema';
import { Like, LikeSchema } from './like.schema';
import { User, UserSchema } from '@/users/user.schema';
import { RedisModule } from '@/redis/redis.module';
import { PostsGateway } from './posts.gateway';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Like.name, schema: LikeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RedisModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [PostsService, PostsGateway],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
