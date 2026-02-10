import { QueueName } from './../common/enums/queue.enum';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MailJob } from '@/common/enums';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue(QueueName.MAIL_QUEUE) private readonly mailQueue: Queue,
  ) {}

  async sendWelcomeEmail(email: string, name: string, lang: 'vi' | 'en') {
    await this.mailQueue.add(
      MailJob.SEND_WELCOME_EMAIL,
      {
        email,
        name,
        lang,
      },
      {
        attempts: 3,
        backoff: 5000,
      },
    );
    return { success: true, message: 'Email has been queued!' };
  }
}
