import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../common/database/prisma.service';
import { RedisHealthIndicator } from './redis.health';

@Module({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [PrismaService, RedisHealthIndicator],
})
export class HealthModule { }

