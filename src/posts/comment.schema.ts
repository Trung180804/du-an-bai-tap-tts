import { Prop, Schema } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { SchemaFactory } from "@nestjs/mongoose";

@Schema({ timestamps: true })
export class Comment extends Document {
  @Prop({ required: true }) content: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  post: Types.ObjectId;

  @Prop({ default: false}) isDeleted: boolean;
}
export const CommentSchema = SchemaFactory.createForClass(Comment);
