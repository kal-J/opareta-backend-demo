import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import {
  PaymentProvider,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  CheckPaymentStatusRequest,
  CheckPaymentStatusResponse,
} from './provider.interface';

@Injectable()
export class MtnProvider implements PaymentProvider {
  private readonly providerName = 'MTN';

  getProviderName(): string {
    return this.providerName;
  }

  async initiatePayment(
    request: InitiatePaymentRequest,
  ): Promise<InitiatePaymentResponse> {
    // Mock implementation 
    // - simulate API call delay
    await this.simulateDelay(500);

    // Mock: 90% success rate for demonstration
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      const successProviderTransactionId = `MTN-SUCCESS-${Date.now()}-${(Math.random() * 1000000).toFixed(0)}`;
      const failedProviderTransactionId = `MTN-SUCCESS-${Date.now()}-${(Math.random() * 1000000).toFixed(0)}`;
      const providerTransactionId = Math.random() > 0.4 ? successProviderTransactionId : failedProviderTransactionId;
      return {
        success: true,
        provider_transaction_id: providerTransactionId,
        status: PaymentStatus.PENDING,
        message: 'Payment initiated successfully. Please approve on your mobile device.',
      };
    }

    return {
      success: false,
      provider_transaction_id: '',
      status: PaymentStatus.FAILED,
      message: 'Failed to initiate payment',
    };
  }

  async checkPaymentStatus(
    request: CheckPaymentStatusRequest,
  ): Promise<CheckPaymentStatusResponse> {
    // Mock implementation - simulate API call delay
    await this.simulateDelay(300);

    // Mock: Determine status based on transaction ID pattern
    const status = request.provider_transaction_id.includes('FAILED') ?
      PaymentStatus.FAILED : (
        request.provider_transaction_id.includes('SUCCESS') ? PaymentStatus.SUCCESS : PaymentStatus.PENDING
      );


    return {
      status,
      provider_transaction_id: request.provider_transaction_id,
      message:
        status === PaymentStatus.SUCCESS
          ? 'Payment completed successfully'
          : status === PaymentStatus.PENDING
            ? 'Payment is still pending'
            : 'Payment failed',
    };
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

