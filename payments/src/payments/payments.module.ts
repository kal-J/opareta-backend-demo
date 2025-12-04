import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { AuthModule } from '../auth/auth.module';
import { MtnProvider } from './providers/mtn.provider';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    MtnProvider,
  ],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule { }

