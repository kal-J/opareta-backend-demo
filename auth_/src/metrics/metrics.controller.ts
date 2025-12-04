import { Controller, Get, Header } from '@nestjs/common';
import { Registry, collectDefaultMetrics } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

@Controller('metrics')
export class MetricsController {
    @Get()
    @Header('Content-Type', register.contentType)
    async getMetrics(): Promise<string> {
        return register.metrics();
    }
}

