import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  Currency,
  PaymentProvider,
  Prisma,
} from '@prisma/client';

export type PaymentWithRelations = Payment & {
  currency: {
    name: string;
    id: number;
  };
  payment_method: {
    name: string;
  } & {
    payment_provider: {
      name: string;
    };
  };
};

@Injectable()
export class PaymentsRepository {
  private readonly logger = new Logger(PaymentsRepository.name);

  constructor(private readonly prisma: PrismaService) { }

  async getCurrencyByName(name: string): Promise<Currency | null> {
    return this.prisma.currency.findUnique({
      where: { name },
    });
  }

  async getCurrencyById(id: number): Promise<Currency | null> {
    return this.prisma.currency.findUnique({
      where: { id },
    });
  }

  async getPaymentMethodByName(name: string): Promise<PaymentMethod | null> {
    return this.prisma.paymentMethod.findUnique({
      where: { name },
    });
  }
  async getPaymentMethodById(id: number): Promise<PaymentMethod | null> {
    return this.prisma.paymentMethod.findUnique({
      where: { id },
    });
  }

  async getPaymentMethodWithProvider(id: number): Promise<(PaymentMethod & { payment_provider: PaymentProvider }) | null> {
    return this.prisma.paymentMethod.findUnique({
      where: { id },
      include: { payment_provider: true },
    });
  }

  async getPaymentProviderByName(name: string): Promise<PaymentProvider | null> {
    return this.prisma.paymentProvider.findUnique({
      where: { name },
    });
  }

  async getPaymentProviderById(id: number): Promise<PaymentProvider | null> {
    return this.prisma.paymentProvider.findUnique({
      where: { id },
    });
  }

  async create(data: {
    reference_id: string;
    customer_phone: string;
    customer_email?: string;
    amount: number;
    currency_id: number;
    payment_method_id: number;
    status?: PaymentStatus;
  }): Promise<PaymentWithRelations> {
    this.logger.debug(`Creating payment with reference: ${data.reference_id}`);
    return this.prisma.payment.create({
      data: {
        ...data,
        status: data.status || PaymentStatus.INITIATED,
      },
      include: {
        currency: {
          select: {
            name: true,
            id: true,
          }
        },
        payment_method: {
          select: {
            name: true,
            payment_provider: {
              select: {
                name: true,
              }
            }
          }
        },

      }
    });
  }

  async findByReference(reference_id: string): Promise<PaymentWithRelations | null> {
    this.logger.debug(`Finding payment by reference: ${reference_id}`);
    return this.prisma.payment.findUnique({
      where: { reference_id },
      include: {
        currency: {
          select: {
            name: true,
            id: true,
          }
        },
        payment_method: {
          select: {
            name: true,
            payment_provider: {
              select: {
                name: true,
              }
            }
          }
        },

      }
    });
  }

  async findById(id: number): Promise<PaymentWithRelations | null> {
    this.logger.debug(`Finding payment by ID: ${id}`);
    return this.prisma.payment.findUnique({
      where: { id },
      include: {
        currency: {
          select: {
            name: true,
            id: true,
          }
        },
        payment_method: {
          select: {
            name: true,
            payment_provider: {
              select: {
                name: true,
              }
            }
          }
        },

      }
    });
  }

  async updateStatus(
    id: number,
    status: PaymentStatus,
    provider_transaction_id?: string,
  ): Promise<PaymentWithRelations> {
    this.logger.debug(
      `Updating payment ${id} status to ${status} with provider_transaction_id: ${provider_transaction_id}`,
    );
    return this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(provider_transaction_id && {
          provider_transaction_id,
        }),
      },
      include: {
        currency: {
          select: {
            name: true,
            id: true,
          }
        },
        payment_method: {
          select: {
            name: true,
            payment_provider: {
              select: {
                name: true,
              }
            }
          }
        },

      }
    });
  }

  async updateByReference(
    reference_id: string,
    data: {
      status?: PaymentStatus;
      provider_transaction_id?: string;
      provider_name?: string;
    },
  ): Promise<PaymentWithRelations> {
    this.logger.debug(`Updating payment by reference: ${reference_id}`);
    return this.prisma.payment.update({
      where: { reference_id },
      data,
      include: {
        currency: {
          select: {
            name: true,
            id: true,
          }
        },
        payment_method: {
          select: {
            name: true,
            payment_provider: {
              select: {
                name: true,
              }
            }
          }
        },

      }
    });
  }

  async findWebhookEvent(payment_reference_id: string) {
    this.logger.debug(`Finding webhook event by payment reference ID: ${payment_reference_id}`);
    return this.prisma.webhookEvent.findUnique({
      where: { payment_reference_id },
    });
  }

  async createWebhookEvent(data: {
    payment_reference_id: string;
    status: PaymentStatus;
    provider_transaction_id: string;
    timestamp: Date;
    is_processed: boolean;
  }) {
    this.logger.debug(
      `Creating webhook event with payment reference ID: ${data.payment_reference_id}`,
    );
    return this.prisma.webhookEvent.create({
      data: {
        provider_transaction_id: data.provider_transaction_id,
        timestamp: data.timestamp,
        status: data.status,
        payment_reference_id: data.payment_reference_id,
        is_processed: data.is_processed,
      },
    });
  }

  async markWebhookAsProcessed(payment_reference_id: string) {
    this.logger.debug(`Marking webhook as processed: ${payment_reference_id}`);
    return this.prisma.webhookEvent.update({
      where: { payment_reference_id },
      data: { is_processed: true },
    });
  }

  async transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async processWebhookTransaction(
    paymentId: number,
    webhookData: {
      payment_reference_id: string;
      status: PaymentStatus;
      provider_transaction_id: string;
      timestamp: Date;
    },
  ): Promise<PaymentWithRelations> {
    this.logger.debug(
      `Processing webhook transaction for payment ID: ${paymentId}`,
    );
    return this.prisma.$transaction(async (tx) => {
      await tx.webhookEvent.upsert({
        where: {
          payment_reference_id: webhookData.payment_reference_id,
        },
        create: {
          status: webhookData.status,
          provider_transaction_id: webhookData.provider_transaction_id,
          timestamp: webhookData.timestamp,
          is_processed: true,
          payment_reference_id: webhookData.payment_reference_id,
        },
        update: {
          is_processed: true,
          status: webhookData.status,
        },
      });

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: webhookData.status,
          provider_transaction_id: webhookData.provider_transaction_id,
        },
        include: {
          currency: {
            select: {
              id: true,
              name: true,
            },
          },
          payment_method: {
            select: {
              name: true,
              payment_provider: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });
  }
}

