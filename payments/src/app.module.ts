import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [CommonModule, AuthModule, PaymentsModule, HealthModule, MetricsModule],
  controllers: [],
  providers: [],
})
export class AppModule { }
