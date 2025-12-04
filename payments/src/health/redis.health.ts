import { Injectable, Inject } from '@nestjs/common';
import {
    HealthIndicatorService,
    HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
    private readonly redis: Redis;

    constructor(
        @Inject(RedisService) private readonly redisService: RedisService,
        private readonly healthIndicatorService: HealthIndicatorService,
    ) {
        this.redis = (this.redisService as any).getClient() as Redis;
    }

    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        const indicator = this.healthIndicatorService.check(key);

        try {
            const result = await this.redis.ping();
            const isHealthy = result === 'PONG';

            if (isHealthy) {
                return indicator.up({ message: result });
            }

            return indicator.down({ message: 'Redis ping failed' });
        } catch (error) {
            return indicator.down({ message: error.message });
        }
    }
}

