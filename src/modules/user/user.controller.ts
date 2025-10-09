import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('findAll') // 👈 đây là route /user/findAll
  findAll() {
    return this.userService.findAll();
  }
}
