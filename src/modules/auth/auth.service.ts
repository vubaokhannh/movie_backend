import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
// import { RedisService } from '../shared/redis/redis.service';

import { User } from '@prisma/client';

import { RegisterDto } from './dtos/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    // private redisService: RedisService,
  ) {}
  register = async (userData: RegisterDto): Promise<User> => {
    const user = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (user) {
      throw new HttpException(
        { message: 'Email already exists' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashPassword = await bcrypt.hash(userData.password, 10);

    const res = await this.prisma.user.create({
      data: { ...userData, password: hashPassword },
    });
    return { ...res, id: Number(res.id) } as User;
  };

  login = async (data: {
    email: string;
    password: string;
  }): Promise<{ accessToken: string; refreshToken: string }> => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new HttpException(
        { message: 'Account does not exist' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.password) {
      throw new HttpException(
        { message: 'This account does not support password login' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const verify = await bcrypt.compare(data.password, user.password);
    if (!verify) {
      throw new HttpException(
        { message: 'Invalid password' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload = {
      id: Number(user.id),
      name: user.name,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_KEY,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_KEY,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  };
}
