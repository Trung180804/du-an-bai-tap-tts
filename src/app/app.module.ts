import { MinioModule } from 'src/minio/minio.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { PostsModule } from '../posts/posts.module';
import { join } from 'path';
import { BullModule } from '@nestjs/bull';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { RedisModule } from '@/redis/redis.module';
import { MailModule } from '@/mail/mail.module';
import Handlebars from 'handlebars';
import strict from 'assert/strict';
import { ScheduleModule } from '@nestjs/schedule';
import { StripeModule } from '@/stripe/stripe.module';
import { AwsModule } from '@/aws/aws.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    MinioModule,
    PostsModule,
    RedisModule,
    MailModule,
    StripeModule,
    AwsModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {}
