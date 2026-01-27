import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class User extends Document {
  @Prop({ required: true, unique: true }) email: string;

  @Prop({ required: true, select: false }) password: string;

  @Prop() resetToken: string;

  @Prop({ default: null, select: false }) twoFactorAuthSecret: string;

  @Prop({ default: false }) isTwoFactorAuthEnabled: boolean;

  @Prop() avatar: string;

  @Prop() name: string;

  @Prop() address: string;

  @Prop() phoneNumber: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
