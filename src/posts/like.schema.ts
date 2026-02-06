import { Prop, Schema } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { SchemaFactory } from "@nestjs/mongoose";
import { Post } from "./post.schema";

@Schema({ timestamps: true })
export class Like extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;
}
export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index({ user: 1, post: 1 }, { unique: true });
