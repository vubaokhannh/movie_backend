import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../shared/redis/redis.service';
import { User } from '@prisma/client';
import { RegisterDto } from './dtos/auth.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

interface JwtPayload {
  uid: string;
  pv: number;
  roles: string[];
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(userData: RegisterDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        permissionValue: 1,
        roles: ['user'],
      },
    });

    const { password, ...safeUser } = newUser;
    return safeUser as User;
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new HttpException('Account not found', HttpStatus.UNAUTHORIZED);
    }

    if (!user.password) {
      throw new HttpException(
        'This account does not support password login',
        HttpStatus.BAD_REQUEST,
      );
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      throw new HttpException('Invalid password', HttpStatus.UNAUTHORIZED);
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: process.env.REFRESH_TOKEN_KEY },
      );

      const storedToken = await this.redisService.get(`refresh:${decoded.uid}`);

      if (storedToken !== refreshToken) {
        throw new HttpException(
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const newPayload: JwtPayload = {
        uid: decoded.uid,
        pv: decoded.pv,
        roles: decoded.roles,
        jti: randomUUID(),
      };

      const [accessToken, newRefreshToken] = await Promise.all([
        this.generateAccessToken(newPayload),
        this.generateRefreshToken(newPayload),
      ]);

      await this.redisService.set(
        `refresh:${decoded.uid}`,
        newRefreshToken,
        'EX',
        7 * 24 * 3600,
      );

      return { accessToken, refreshToken: newRefreshToken };
    } catch (err) {
      throw new HttpException(
        'Token expired or invalid',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async logout(userId: number) {
    await this.redisService.del(`refresh:${userId}`);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: User) {
    const payload: JwtPayload = {
      uid: String(user.id),
      pv: user.permissionValue,
      roles: user.roles,
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    await this.redisService.set(
      `refresh:${user.id}`,
      refreshToken,
      'EX',
      7 * 24 * 3600,
    );

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.ACCESS_TOKEN_KEY,
      expiresIn: '15m',
    });
  }

  private async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.REFRESH_TOKEN_KEY,
      expiresIn: '7d',
    });
  }
}
