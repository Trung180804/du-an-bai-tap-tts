import { Prop, Schema } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class Post extends Document {
  @Prop({ required: true }) title: string;

  @Prop({ required: true }) content: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ default: 0 }) likesCount: number;

  @Prop({ default: 0 }) commentsCount: number;

  @Prop() imageUrl?: string;

  @Prop({ default: false }) isDeleted: boolean;

  @Prop() deletedAt?: Date;
}
export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });
PostSchema.index({ likesCount: -1 });
