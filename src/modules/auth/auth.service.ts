import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../shared/redis/redis.service';
import { User } from '@prisma/client';
import {
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dtos/auth.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../shared/mail/email.services';
import { randomBytes, randomUUID } from 'crypto';
import { ERROR_CODES } from '../../constants/error-codes';
import { REDIS_KEYS } from '../../constants/redis-keys';
import { appConfig } from '../../config';

interface JwtPayload {
  uid: string;
  jti: string;
  // exp, iat will be present at runtime but not required here
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async register(userData: RegisterDto): Promise<Partial<User>> {
    const existing = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      throw new HttpException(
        {
          code: ERROR_CODES.USER_EXISTS.code,
          message: ERROR_CODES.USER_EXISTS.publicMessage,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const salt = randomBytes(5).toString('hex');
    const hashedPassword = await bcrypt.hash(userData.password + salt, 10);

    const newUser = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        salt,
      },
    });

    return newUser;
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new HttpException(
        {
          code: ERROR_CODES.ACCOUNT_NOT_FOUND.code,
          message: ERROR_CODES.ACCOUNT_NOT_FOUND.publicMessage,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.password || !user.salt) {
      throw new HttpException(
        {
          code: ERROR_CODES.INVALID_CREDENTIALS.code,
          message: ERROR_CODES.INVALID_CREDENTIALS.publicMessage,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const valid = await bcrypt.compare(
      data.password + user.salt,
      user.password,
    );
    if (!valid) {
      throw new HttpException(
        {
          code: ERROR_CODES.INVALID_CREDENTIALS.code,
          message: ERROR_CODES.INVALID_CREDENTIALS.publicMessage,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync<any>(refreshToken, {
        secret: appConfig.token.refreshTokenKey,
      });

      const redisKey = REDIS_KEYS.refreshToken(decoded.uid, decoded.jti);
      const storedToken = await this.redisService.get(redisKey);

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException({
          code: ERROR_CODES.TOKEN_INVALID.code,
          message: ERROR_CODES.TOKEN_INVALID.publicMessage,
        } as any);
      }

      const newPayload: JwtPayload = {
        uid: decoded.uid,
        jti: randomUUID(),
      };

      const [accessToken, newRefreshToken] = await Promise.all([
        this.generateAccessToken(newPayload),
        this.generateRefreshToken(newPayload),
      ]);

      const refreshTTLSeconds = this._parseTTLToSeconds(
        appConfig.token.refreshTokenExpiresIn,
      );
      await this.redisService.set(
        REDIS_KEYS.refreshToken(decoded.uid, newPayload.jti),
        newRefreshToken,
        'EX',
        refreshTTLSeconds,
      );

      await this.redisService.del(redisKey);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (err) {
      throw new HttpException(
        {
          code: ERROR_CODES.TOKEN_INVALID.code,
          message: ERROR_CODES.TOKEN_INVALID.publicMessage,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async logout(accessToken: string, userId?: number) {
    console.log('Access Token nhận được:', accessToken);

    try {
      const decoded = await this.jwtService.verifyAsync<any>(accessToken, {
        secret: process.env.ACCESS_TOKEN_KEY || 'default_access_secret',
        ignoreExpiration: true,
      });

      console.log('Decoded token:', decoded);

      const uid = String(userId || decoded.uid);
      const jti = decoded.jti;

      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp ? Math.max(0, decoded.exp - now) : 60;

      await this.redisService.set(
        `blacklist:${uid}:${jti}`,
        'revoked',
        'EX',
        ttl,
      );
      await this.redisService.del(`refresh:${uid}:${jti}`);

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.log('Logout error:', error);
      return { message: 'Logged out' };
    }
  }

  private async generateTokens(user: User) {
    const payload: JwtPayload = {
      uid: String(user.id),
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    const refreshTTLSeconds = this._parseTTLToSeconds(
      appConfig.token.refreshTokenExpiresIn,
    );
    await this.redisService.set(
      REDIS_KEYS.refreshToken(user.id, payload.jti),
      refreshToken,
      'EX',
      refreshTTLSeconds,
    );

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: appConfig.token.accessTokenKey,
      expiresIn: appConfig.token.accessTokenExpiresIn,
    });
  }

  private async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: appConfig.token.refreshTokenKey,
      expiresIn: appConfig.token.refreshTokenExpiresIn,
    });
  }

  // --------------------------
  // HELPERS
  // chuyển đổi chuỗi TTL thời gian sống của token hoặc cache — sang giây (seconds)
  // --------------------------
  private _parseTTLToSeconds(ttl: string): number {
    if (!ttl) return 0;
    const match = /^(\d+)([smhd])?$/.exec(ttl);
    if (!match) return Number(ttl) || 0;
    const v = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return v;
      case 'm':
        return v * 60;
      case 'h':
        return v * 3600;
      case 'd':
        return v * 24 * 3600;
      default:
        return v;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException('Email không tồn tại.');
    }

    await this.prisma.resetPasswordToken.deleteMany({
      where: { userId: user.id },
    });

    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    const expiration = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.resetPasswordToken.create({
      data: {
        token: hashedToken,
        expirationDate: expiration,
        userId: user.id,
      },
    });

    const resetLink = `${appConfig.frontendUrl}/reset-password?token=${resetToken}&email=${user.email}`;

    await this.emailService.sendMail(
      user.email,
      'Yêu cầu đặt lại mật khẩu',
      `Nhấn vào liên kết để đặt lại mật khẩu: ${resetLink}`,
      `<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>
       <p>Nhấn vào liên kết sau để tiếp tục:</p>
       <a href="${resetLink}">Đặt lại mật khẩu</a>
       <p>Liên kết này sẽ hết hạn sau 15 phút.</p>`,
    );

    return { message: 'Email đặt lại mật khẩu đã được gửi.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { resetTokens: true },
    });

    if (!user || user.resetTokens.length === 0) {
      throw new BadRequestException('Không tìm thấy yêu cầu đặt lại mật khẩu.');
    }

    const latestToken = user.resetTokens[user.resetTokens.length - 1];

    const isMatch = await bcrypt.compare(dto.token, latestToken.token);
    const isExpired = latestToken.expirationDate < new Date();
    if (!isMatch || isExpired || latestToken.consumed) {
      throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn.');
    }

    const salt = user.salt || randomBytes(5).toString('hex');
    const hashedPassword = await bcrypt.hash(dto.newPassword + salt, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, salt },
      }),
      this.prisma.resetPasswordToken.update({
        where: { id: latestToken.id },
        data: { consumed: true },
      }),
    ]);

    return { message: 'Mật khẩu đã được thay đổi thành công.' };
  }
}
