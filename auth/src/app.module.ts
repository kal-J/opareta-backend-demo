import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [CommonModule, AuthModule, HealthModule, MetricsModule],
  controllers: [],
  providers: [AppService],
})
export class AppModule { }
