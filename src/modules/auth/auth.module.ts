import { Module, ValidationPipe } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { APP_PIPE } from '@nestjs/core';
import { SharedModule } from '../shared/shared.module';
import { JwtStrategy } from '../auth/strategy/index';
@Module({
  imports: [SharedModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    JwtStrategy,
  ],
})
export class AuthModule {}
