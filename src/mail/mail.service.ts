import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
  ) {}

  async sendWelcomeEmail(email: string, name: string, lang: 'vi' | 'en') {
    await this.mailQueue.add(
      'sendWelcomeEmail',
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
