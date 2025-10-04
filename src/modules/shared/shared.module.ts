import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
// import { RedisService } from './redis/redis.service';
// import { EmailService } from './mail/email.services';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedModule {}
