import * as fs from 'fs';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { join } from 'path';
import * as handlebars from 'handlebars';

@Processor('mail-queue')
export class MailProcessor {
  constructor(private readonly mailerService: MailerService) {}

  @Process('sendWelcomeEmail')
  async handleSendWelcomeEmail(job: Job) {
    const { email, name, lang = 'vi' } = job.data;

    const rootDir = process.cwd();
    const logoPath = join(rootDir, 'src', 'templates', 'images', 'logo.jpg');
    const placeholderPath = join(rootDir, 'src', 'templates', 'images', 'placeholder.jpg');

    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath, 'base64') : '';
    const placeholderBase64 = fs.existsSync(placeholderPath) ? fs.readFileSync(placeholderPath, 'base64') : '';

    const templateFile = `welcome.${lang}.hbs`;
    const templatePath = join(rootDir, 'src', 'templates', templateFile);

    let source = '';
    if (fs.existsSync(templatePath)) {
      source = fs.readFileSync(templatePath, 'utf8');
    } else {
      source = fs.readFileSync(join(rootDir, 'src', 'templates', 'welcome.vi.hbs'), 'utf8');
    }

    const template = handlebars.compile(source);
    const finalHtml = template({ name, logoBase64, placeholderBase64 });

    const subject = lang === 'en' 
        ? 'Welcome to our system!'
        : 'Chào mừng bạn tham gia hệ thống!';

    await this.mailerService.sendMail({
      to: email,
      subject,
      html: finalHtml,
    });

    console.log(`--- Send mail ${lang.toUpperCase()} succesfully to: ${email} ---`);
  }
}
