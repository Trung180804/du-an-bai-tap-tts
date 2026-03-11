import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { getQueueToken } from '@nestjs/bull';
import { QueueName } from '@/common/enums/queue.enum';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: getQueueToken(QueueName.MAIL_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-123' }) },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should queue welcome email successfully', async () => {
    expect(service).toBeDefined();

    const result = await service.sendWelcomeEmail(
      'test@gmail.com',
      'Trung',
      'vi',
    );

    expect(result).toEqual({
      success: true,
      message: 'Email has been queued!',
    });
  });
});
