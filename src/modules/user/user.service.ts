import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  
  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isPremium: true,
        createdAt: true,
      },
    });
  }
}
