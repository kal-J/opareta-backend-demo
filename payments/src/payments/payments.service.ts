import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentWithRelations, PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { WebhookDto } from './dto/webhook.dto';
import { PaymentStatus, Payment } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PaymentProvider } from './providers/provider.interface';
import { MtnProvider } from './providers/mtn.provider';
import { UtilsService } from 'src/common/utils.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providerMap: Map<string, PaymentProvider>;

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly mtnProvider: MtnProvider,
    private readonly utilsService: UtilsService,
  ) {
    this.providerMap = new Map<string, PaymentProvider>();

    // Map both 'MTN' and 'MTN_UGANDA' to the same provider for compatibility
    this.providerMap.set(this.mtnProvider.getProviderName(), this.mtnProvider);
    this.providerMap.set('MTN_UGANDA', this.mtnProvider);
  }


  private generatePaymentReference(): string {
    const timestamp = Date.now();
    const uuid = randomUUID().substring(0, 8).toUpperCase();
    return `PAY-${timestamp}-${uuid}`;
  }


  private validateStateTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
  ): boolean {
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.INITIATED]: [PaymentStatus.PENDING],
      [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
      [PaymentStatus.SUCCESS]: [],
      [PaymentStatus.FAILED]: [],
    };

    const allowedStates = validTransitions[currentStatus] || [];
    return allowedStates.includes(newStatus);
  }

  private async initiatePayment(payment: (Payment & {
    currency: {
      name: string;
      id: number;
    }, payment_method: {
      name: string;
      payment_provider: {
        name: string;
      };
    }
  })): Promise<PaymentWithRelations> {
    this.logger.log(
      `Initiating payment with provider for reference: ${payment.reference_id}`,
    );

    const initiateRequest = {
      amount: payment.amount,
      currency: payment.currency.name,
      customer_phone: payment.customer_phone,
      customer_email: payment.customer_email || undefined,
      reference_id: payment.reference_id,
    };
    const provider = this.providerMap.get(payment.payment_method.payment_provider.name);
    if (!provider) {
      throw new NotFoundException(
        `Payment provider not supported`,
      );
    }

    const response = await provider.initiatePayment(initiateRequest);

    const updatedPayment = await this.paymentsRepository.updateByReference(
      payment.reference_id,
      {
        status: response.status,
        provider_transaction_id: response.provider_transaction_id,
        provider_name: provider.getProviderName(),
      },
    );

    this.logger.log(
      `Payment ${payment.reference_id} initiated with provider ${provider.getProviderName()}. Status: ${response.status}`,
    );

    return updatedPayment;
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    this.logger.log('Creating new payment');

    const reference_id = this.generatePaymentReference();
    this.logger.debug(`Generated payment reference: ${reference_id}`);

    const currency = await this.paymentsRepository.getCurrencyByName(createPaymentDto.currency);
    if (!currency) {
      throw new NotFoundException(`Currency ${createPaymentDto.currency} not found`);
    }

    const payment_method = await this.paymentsRepository.getPaymentMethodByName(createPaymentDto.payment_method);
    if (!payment_method) {
      throw new NotFoundException(`Payment method ${createPaymentDto.payment_method} not found`);
    }

    const payment = await this.paymentsRepository.create({
      reference_id,
      customer_phone: createPaymentDto.customer_phone,
      customer_email: createPaymentDto.customer_email,
      amount: createPaymentDto.amount,
      currency_id: currency.id,
      payment_method_id: payment_method.id,
      status: PaymentStatus.INITIATED,

    });

    this.logger.log(
      `Payment created successfully with reference: ${reference_id}`,
    );

    return await this.initiatePayment(payment);
  }

  /**
   * Get payment by reference
   */
  async getPaymentByReference(reference_id: string): Promise<PaymentWithRelations> {
    this.logger.log(`Getting payment by reference: ${reference_id}`);

    const payment = await this.paymentsRepository.findByReference(
      reference_id,
    );

    if (!payment) {
      this.logger.warn(`Payment not found with reference: ${reference_id}`);
      throw new NotFoundException(
        `Payment with reference ${reference_id} not found`,
      );
    }

    return payment;
  }


  async updatePaymentStatus(
    updateDto: UpdatePaymentStatusDto,
  ): Promise<PaymentWithRelations> {
    const { payment_reference_id, status, provider_transaction_id } = updateDto;
    this.logger.log(
      `Updating payment status for reference: ${payment_reference_id} to ${status}`,
    );

    const payment = await this.paymentsRepository.findByReference(
      payment_reference_id,
    );

    if (!payment) {
      this.logger.warn(`Payment not found with reference: ${payment_reference_id}`);
      throw new NotFoundException(
        `Payment with reference ${payment_reference_id} not found`,
      );
    }

    if (!this.validateStateTransition(payment.status, status)) {
      this.logger.warn(
        `Invalid state transition from ${payment.status} to ${status} for payment ${payment_reference_id}`,
      );
      throw new BadRequestException(
        `Invalid state transition from ${payment.status} to ${status}`,
      );
    }

    const updatedPayment = await this.paymentsRepository.updateByReference(
      payment_reference_id,
      {
        status: status,
        provider_transaction_id: provider_transaction_id,
      },
    );

    this.logger.log(
      `Payment ${payment_reference_id} status updated to ${status}`,
    );

    return updatedPayment;
  }


  async handleWebhook(webhookDto: WebhookDto): Promise<PaymentWithRelations> {
    const lockKey = `payment:webhook:${webhookDto.payment_reference_id}`;
    const lock = await this.utilsService.redisLock(lockKey, 1000 * 10);
    if (!lock) {
      this.logger.warn(
        `Webhook already being processed for payment reference: ${webhookDto.payment_reference_id}`,
      );
      throw new BadRequestException('Webhook already being processed');
    }
    this.logger.log(
      `Processing webhook for payment reference: ${webhookDto.payment_reference_id}`,
    );

    const existingWebhook = await this.paymentsRepository.findWebhookEvent(
      webhookDto.payment_reference_id,
    );

    if (existingWebhook && existingWebhook.is_processed) {
      this.logger.log(
        `Webhook for payment reference ${webhookDto.payment_reference_id} already processed, returning existing payment`,
      );
      const payment = await this.paymentsRepository.findByReference(
        webhookDto.payment_reference_id,
      );
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }
      return payment;
    }

    const payment = await this.paymentsRepository.findByReference(
      webhookDto.payment_reference_id,
    );

    if (!payment) {
      this.logger.warn(
        `Payment not found with reference: ${webhookDto.payment_reference_id}`,
      );
      throw new NotFoundException(
        `Payment with reference ${webhookDto.payment_reference_id} not found`,
      );
    }

    if (!this.validateStateTransition(payment.status, webhookDto.status)) {
      this.logger.warn(
        `Invalid state transition from ${payment.status} to ${webhookDto.status} for payment ${webhookDto.payment_reference_id}`,
      );
      throw new BadRequestException(
        `Invalid state transition from ${payment.status} to ${webhookDto.status}`,
      );
    }

    const updatedPayment = await this.paymentsRepository.processWebhookTransaction(
      payment.id,
      {
        payment_reference_id: webhookDto.payment_reference_id,
        status: webhookDto.status,
        provider_transaction_id: webhookDto.provider_transaction_id,
        timestamp: new Date(webhookDto.timestamp),
      },
    );

    this.logger.log(
      `Webhook processed successfully for payment ${webhookDto.payment_reference_id}, status updated to ${webhookDto.status}`,
    );

    return updatedPayment;
  }
}
