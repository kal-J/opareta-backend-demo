import { RedisLockService } from '@huangang/nestjs-simple-redis-lock';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsService {
    constructor(
        protected readonly redisLockService: RedisLockService,
    ) { }

    async redisLock(key: string, unlockAfter: number = 1000 * 60 * 10) {
        return await this.redisLockService.lockOnce(key, unlockAfter);
    }

    async redisUnlock(key: string) {
        await this.redisLockService.unlock(key);
    }


}
