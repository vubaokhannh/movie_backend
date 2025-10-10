import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { GetUser } from '../auth/decorator/index';
import { MyJwtGuard } from '../auth/guard/index';
import type { User } from '@prisma/client';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('findAll')
  findAll() {
    return this.userService.findAll();
  }

  @UseGuards(MyJwtGuard)
  @Get('me')
  me(@GetUser() user: User) {
    return user;
  }
}
