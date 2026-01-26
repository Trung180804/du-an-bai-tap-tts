import {
  Controller, Get, Patch, Body, UseGuards,
  Request, ForbiddenException, UseInterceptors, UploadedFile 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '@/getUser.decorator';

import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/updateUser.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from 'src/minio/minio.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService, private minioService: MinioService) {}

  @Get('all')
  getAllUsers() {
    return this.usersService.findAll();
  }

  // login to use
  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: any) {
    if(req.user.isTwoFactorPending) {
      throw new ForbiddenException('2FA verification required');
    }
    return this.usersService.findOne(req.user.userId);
  }

  @ApiBearerAuth()
  @Get('email')
  @UseGuards(AuthGuard('jwt'))
  getUserEmail(@GetUser('email') email: string) {
    return { email };
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiBearerAuth()
  async updateProfile(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateDto: UpdateUserDto,
  ) {
    if(req.user.isTwoFactorPending) {
      throw new ForbiddenException('2FA verification required');
    }

    let avatarUrl: string | undefined = undefined;
    if (file) {
      avatarUrl = await this.minioService.upLoadFile(file);
    }

    return this.usersService.updateProfile(req.user.userId, {
      ...updateDto,
      ...(avatarUrl && { avatar: avatarUrl }),
    });
  }

  @Get('profile')
  async getMyProfile(@Request() req: any) {
    if(req.user.isTwoFactorPending) {
      throw new ForbiddenException('2FA verification required');
    }

    const user = await this.usersService.findOne(req.user.userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    const { password, twoFactorAuthSecret, ...result } = user.toObject();
    return result;
  }
}
