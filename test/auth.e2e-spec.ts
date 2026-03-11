import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './../src/app/app.module';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './../src/users/user.schema';
import request from 'supertest';
import { mockUserId } from './test-helpers/mock-data.factory';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('123456', 10);

    const mockUserModel = {
      findOne: jest.fn().mockImplementation((query) => {
        if (query.email === 'test@gmail.com') {
          return {
            select: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: mockUserId,
                email: 'test@gmail.com',
                password: hashedPassword,
                isTwoFactorAuthenticationEnabled: false,
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        };
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(getModelToken(User.name))
      .useValue(mockUserModel)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('responds with json (use expect)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@gmail.com', password: '123456' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(201);
    });

    it('responds with json (use async/await)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@gmail.com', password: '123456' })
        .set('Accept', 'application/json');

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.status).toEqual(201);
      expect(response.body).toHaveProperty('access_token');
    });

    it('responds with 400 Bad Request when validation fails', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: '123456' })
        .set('Accept', 'application/json');

      expect(response.status).toEqual(400);
      expect(response.body.message).toBeInstanceOf(Array);
    });
  });
});
