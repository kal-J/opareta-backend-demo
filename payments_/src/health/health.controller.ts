import { Controller, Get } from '@nestjs/common';
import {
    HealthCheckService,
    HealthCheck,
    PrismaHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../common/database/prisma.service';
import { RedisHealthIndicator } from './redis.health';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private prismaHealth: PrismaHealthIndicator,
        private redisHealth: RedisHealthIndicator,
        private memory: MemoryHealthIndicator,
        private prisma: PrismaService,
    ) { }

    @Get()
    @Public()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.prismaHealth.pingCheck('database', this.prisma),
            () => this.redisHealth.isHealthy('redis'),
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
            () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
        ]);
    }
}

