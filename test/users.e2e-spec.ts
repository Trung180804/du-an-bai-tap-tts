import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { MinioService } from '../src/minio/minio.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  const mockUsersService = {
    updateProfile: jest.fn(),
  };

  const mockMinioService = {
    uploadFile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: MinioService, useValue: mockMinioService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { _id: '123', email: 'user1@example.com' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ====================== UPDATE USER PROFILE ======================
  describe('/users/profile (PATCH)', () => {
    it('should update user profile', async () => {
      const updateDto = { name: 'Trung dep trai' };
      mockUsersService.updateProfile.mockResolvedValue({
        _id: '123',
        email: 'user1@example.com',
        name: 'Trung dep trai',
      });

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', 'Bearer fake-jwt-token')
        .send(updateDto)
        .expect(200);

      expect(response.body).toEqual({
        _id: '123',
        email: 'user1@example.com',
        name: 'Trung dep trai',
      });
    });

    it('should throw 400 Bad Request if validation fails', async () => {
      const wrongDto = { name: 12345 };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', 'Bearer fake-jwt-token')
        .send(wrongDto)
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(response.body.error).toEqual('Bad Request');
    });
  });
});
