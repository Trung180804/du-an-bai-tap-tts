import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';

@Processor('mail-queue')
export class MailProcessor {
  constructor(private readonly mailerService: MailerService) {}

  @Process('sendWelcomeEmail')
  async handleSendWelcomeEmail(job: Job) {
    const { email, name, lang } = job.data;

    // Tự định nghĩa nội dung HTML trực tiếp trong code
    const subject = lang === 'en' ? 'Welcome to our platform!' : 'Chào mừng bạn tham gia hệ thống!';
    
    const htmlContent = lang === 'en' 
      ? `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #333;">Welcome, ${name}!</h1>
          <p>Thank you for joining our platform. We are excited to have you with us.</p>
          <p>Best regards,<br>Trung's Team</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #333;">Chào mừng ${name}!</h1>
          <p>Cảm ơn bạn đã tham gia hệ thống của chúng mình. Rất vui được đồng hành cùng bạn.</p>
          <p>Trân trọng,<br>Trung's Team</p>
        </div>
      `;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: subject,
        html: htmlContent, // Dùng trường 'html' thay vì 'template'
      });
      console.log(`--- Đã gửi mail thành công (Dùng Template String) cho: ${email} ---`);
    } catch (error) {
      console.error('Lỗi khi gửi mail:', error.message);
    }
  }
}