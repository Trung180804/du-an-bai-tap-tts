import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GetUser } from '@/getUser.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('all')
  getAllUsers() {
    return this.usersService.findAll();
  }

  // login to use
  @ApiBearerAuth()
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: any) {
    return req.user;
  }

  @ApiBearerAuth()
  @Get('email')
  @UseGuards(AuthGuard('jwt'))
  getUserEmail(@GetUser('email') email: string) {
    return { email };
  }
}
