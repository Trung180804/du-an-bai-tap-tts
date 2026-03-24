import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Post, PostSchema } from "./post.schema";
import { PostsService } from "./posts.service";
import { PostsController } from "./posts.controller";
import { Comment, CommentSchema } from "./comment.schema";
import { Like, LikeSchema } from "./like.schema";
import { User, UserSchema } from "@/users/user.schema";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Like.name, schema: LikeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
