import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from 'src/auth/getUser.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Public API - không cần đăng nhập
  @Get('all')
  getAllUsers() {
    return this.usersService.findAll();
  }

  // Protected API - yêu cầu JWT token
  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: any) {
    return req.user;
  }

  // Protected API - lấy dữ liệu từ token
  @ApiBearerAuth()
  @Get('email')
  @UseGuards(AuthGuard('jwt'))
  getUserEmail(@GetUser('email') email: string) {
    return { email };
  }
}