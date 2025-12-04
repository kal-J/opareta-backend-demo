import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { RedisLockModule } from '@huangang/nestjs-simple-redis-lock';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { UtilsService } from './utils.service';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      // import RedisModule before RedisLockModule
      useFactory: () =>
        ({
          config: {
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            keyPrefix: ':payments:',
          },
        }) as RedisModuleOptions,
    }),
    RedisLockModule.register({}),
  ],
  providers: [PrismaService, UtilsService],
  exports: [PrismaService, UtilsService],
})
export class CommonModule { }
