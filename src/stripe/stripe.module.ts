import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '@/mail/mail.module';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [ConfigModule, MailModule, RedisModule],
  controllers: [StripeController],
  providers: [StripeService],
})
export class StripeModule {}
