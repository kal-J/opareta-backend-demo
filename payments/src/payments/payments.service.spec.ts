import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { MtnProvider } from './providers/mtn.provider';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { WebhookDto } from './dto/webhook.dto';
import { PaymentStatus } from '@prisma/client';
import { UtilsService } from '../common/utils.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repository: PaymentsRepository;

  const mockPayment = {
    id: 1,
    reference_id: 'PAY-1234567890-ABC123',
    customer_phone: '+256700000000',
    customer_email: 'test@example.com',
    amount: 1000,
    status: PaymentStatus.INITIATED,
    payment_method: 'MOBILE_MONEY',
    currency: 'UGX',
    provider_transaction_id: null,
    provider_name: 'MTN_UGANDA',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPaymentWithRelations = {
    ...mockPayment,
    currency: {
      id: 1,
      name: 'UGX',
    },
    payment_method: {
      name: 'MOBILE_MONEY',
      payment_provider: {
        name: 'MTN_UGANDA',
      },
    },
  };

  const mockRepository = {
    create: jest.fn(),
    findByReference: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    updateByReference: jest.fn(),
    findWebhookEvent: jest.fn(),
    createWebhookEvent: jest.fn(),
    markWebhookAsProcessed: jest.fn(),
    processWebhookTransaction: jest.fn(),
    getCurrencyByName: jest.fn(),
    getPaymentMethodByName: jest.fn(),
  };

  const mockMtnProvider = {
    getProviderName: jest.fn().mockReturnValue('MTN'),
    initiatePayment: jest.fn(),
    checkPaymentStatus: jest.fn(),
  };

  const mockUtilsService = {
    redisLock: jest.fn().mockResolvedValue(true),
    redisUnlock: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PaymentsRepository,
          useValue: mockRepository,
        },
        {
          provide: MtnProvider,
          useValue: mockMtnProvider,
        },
        {
          provide: UtilsService,
          useValue: mockUtilsService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    repository = module.get<PaymentsRepository>(PaymentsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const createDto: CreatePaymentDto = {
      amount: 1000.0,
      currency: 'USD',
      payment_method: 'MOBILE_MONEY',
      customer_phone: '+256700000000',
      customer_email: 'test@example.com',
    };

    it('should create a payment successfully', async () => {
      const currency = { id: 1, name: 'USD' };
      const paymentMethod = {
        id: 1,
        name: 'MOBILE_MONEY',
        payment_provider: { name: 'MTN' },
      };

      mockRepository.getCurrencyByName.mockResolvedValue(currency);
      mockRepository.getPaymentMethodByName.mockResolvedValue(paymentMethod);
      mockRepository.create.mockResolvedValue(mockPaymentWithRelations);
      mockMtnProvider.initiatePayment.mockResolvedValue({
        success: true,
        provider_transaction_id: 'TXN123',
        status: PaymentStatus.PENDING,
        message: 'Payment initiated',
      });
      mockRepository.updateByReference.mockResolvedValue({
        ...mockPaymentWithRelations,
        status: PaymentStatus.PENDING,
        provider_transaction_id: 'TXN123',
        provider_name: 'MTN',
      });

      const result = await service.createPayment(createDto);

      expect(result).toHaveProperty('reference_id');
      expect(mockRepository.getCurrencyByName).toHaveBeenCalledWith(
        createDto.currency,
      );
      expect(mockRepository.getPaymentMethodByName).toHaveBeenCalledWith(
        createDto.payment_method,
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_phone: createDto.customer_phone,
          customer_email: createDto.customer_email,
          amount: createDto.amount,
          currency_id: currency.id,
          payment_method_id: paymentMethod.id,
          status: PaymentStatus.INITIATED,
        }),
      );
    });

    it('should throw NotFoundException when currency not found', async () => {
      mockRepository.getCurrencyByName.mockResolvedValue(null);

      await expect(service.createPayment(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createPayment(createDto)).rejects.toThrow(
        `Currency ${createDto.currency} not found`,
      );
      expect(mockRepository.getCurrencyByName).toHaveBeenCalledWith(
        createDto.currency,
      );
      expect(mockRepository.getPaymentMethodByName).not.toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment method not found', async () => {
      const currency = { id: 1, name: 'USD' };
      mockRepository.getCurrencyByName.mockResolvedValue(currency);
      mockRepository.getPaymentMethodByName.mockResolvedValue(null);

      await expect(service.createPayment(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createPayment(createDto)).rejects.toThrow(
        `Payment method ${createDto.payment_method} not found`,
      );
      expect(mockRepository.getCurrencyByName).toHaveBeenCalledWith(
        createDto.currency,
      );
      expect(mockRepository.getPaymentMethodByName).toHaveBeenCalledWith(
        createDto.payment_method,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create payment with UGX currency', async () => {
      const createDtoUGX: CreatePaymentDto = {
        ...createDto,
        currency: 'UGX',
      };
      const currency = { id: 2, name: 'UGX' };
      const paymentMethod = {
        id: 1,
        name: 'MOBILE_MONEY',
        payment_provider: { name: 'MTN' },
      };

      mockRepository.getCurrencyByName.mockResolvedValue(currency);
      mockRepository.getPaymentMethodByName.mockResolvedValue(paymentMethod);
      mockRepository.create.mockResolvedValue({
        ...mockPaymentWithRelations,
        currency: { id: 2, name: 'UGX' },
      });
      mockMtnProvider.initiatePayment.mockResolvedValue({
        success: true,
        provider_transaction_id: 'TXN123',
        status: PaymentStatus.PENDING,
        message: 'Payment initiated',
      });
      mockRepository.updateByReference.mockResolvedValue({
        ...mockPaymentWithRelations,
        status: PaymentStatus.PENDING,
        provider_transaction_id: 'TXN123',
        provider_name: 'MTN',
      });

      await service.createPayment(createDtoUGX);

      expect(mockRepository.getCurrencyByName).toHaveBeenCalledWith('UGX');
    });
  });

  describe('getPaymentByReference', () => {
    it('should return payment when found', async () => {
      mockRepository.findByReference.mockResolvedValue(mockPayment);

      const result = await service.getPaymentByReference(
        mockPayment.reference_id,
      );

      expect(result).toEqual(mockPayment);
      expect(mockRepository.findByReference).toHaveBeenCalledWith(
        mockPayment.reference_id,
      );
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockRepository.findByReference.mockResolvedValue(null);

      await expect(
        service.getPaymentByReference('INVALID-REF'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status from INITIATED to PENDING successfully', async () => {
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.PENDING,
        provider_transaction_id: 'TXN123',
      };

      const updatedPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      mockRepository.findByReference.mockResolvedValue(mockPayment);
      mockRepository.updateByReference.mockResolvedValue(updatedPayment);

      const result = await service.updatePaymentStatus(updateDto);

      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(mockRepository.updateByReference).toHaveBeenCalledWith(
        mockPayment.reference_id,
        {
          status: updateDto.status,
          provider_transaction_id: updateDto.provider_transaction_id,
        },
      );
    });

    it('should update payment status from PENDING to SUCCESS successfully', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.SUCCESS,
        provider_transaction_id: 'TXN123',
      };

      const updatedPayment = {
        ...pendingPayment,
        status: PaymentStatus.SUCCESS,
      };
      mockRepository.findByReference.mockResolvedValue(pendingPayment);
      mockRepository.updateByReference.mockResolvedValue(updatedPayment);

      const result = await service.updatePaymentStatus(updateDto);

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockRepository.updateByReference).toHaveBeenCalledWith(
        mockPayment.reference_id,
        {
          status: PaymentStatus.SUCCESS,
          provider_transaction_id: 'TXN123',
        },
      );
    });

    it('should update payment status from PENDING to FAILED successfully', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.FAILED,
        provider_transaction_id: 'TXN123',
      };

      const updatedPayment = {
        ...pendingPayment,
        status: PaymentStatus.FAILED,
      };
      mockRepository.findByReference.mockResolvedValue(pendingPayment);
      mockRepository.updateByReference.mockResolvedValue(updatedPayment);

      const result = await service.updatePaymentStatus(updateDto);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(mockRepository.updateByReference).toHaveBeenCalledWith(
        mockPayment.reference_id,
        {
          status: PaymentStatus.FAILED,
          provider_transaction_id: 'TXN123',
        },
      );
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockRepository.findByReference.mockResolvedValue(null);

      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: 'INVALID-REF',
        status: PaymentStatus.PENDING,
      };

      await expect(service.updatePaymentStatus(updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid state transition from INITIATED to SUCCESS', async () => {
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.SUCCESS,
      };

      mockRepository.findByReference.mockResolvedValue(mockPayment);

      await expect(service.updatePaymentStatus(updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updatePaymentStatus(updateDto)).rejects.toThrow(
        'Invalid state transition',
      );
    });

    it('should throw BadRequestException for invalid state transition from SUCCESS to PENDING', async () => {
      const successPayment = { ...mockPayment, status: PaymentStatus.SUCCESS };
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.PENDING,
      };

      mockRepository.findByReference.mockResolvedValue(successPayment);

      await expect(service.updatePaymentStatus(updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid state transition from FAILED to SUCCESS', async () => {
      const failedPayment = { ...mockPayment, status: PaymentStatus.FAILED };
      const updateDto: UpdatePaymentStatusDto = {
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.SUCCESS,
      };

      mockRepository.findByReference.mockResolvedValue(failedPayment);

      await expect(service.updatePaymentStatus(updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWebhook', () => {
    const webhookDto: WebhookDto = {
      payment_reference_id: mockPayment.reference_id,
      status: PaymentStatus.SUCCESS,
      provider_transaction_id: 'TXN123',
      timestamp: new Date().toISOString(),
    };

    it('should process webhook successfully from PENDING to SUCCESS', async () => {
      const pendingPayment = {
        ...mockPaymentWithRelations,
        id: 1,
        status: PaymentStatus.PENDING,
      };
      const updatedPayment = {
        ...pendingPayment,
        status: PaymentStatus.SUCCESS,
        provider_transaction_id: 'TXN123',
      };

      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(pendingPayment);
      mockRepository.processWebhookTransaction.mockResolvedValue(updatedPayment);

      const result = await service.handleWebhook(webhookDto);

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.provider_transaction_id).toBe('TXN123');
      expect(mockRepository.findWebhookEvent).toHaveBeenCalledWith(
        webhookDto.payment_reference_id,
      );
      expect(mockRepository.processWebhookTransaction).toHaveBeenCalledWith(
        pendingPayment.id,
        {
          payment_reference_id: webhookDto.payment_reference_id,
          status: webhookDto.status,
          provider_transaction_id: webhookDto.provider_transaction_id,
          timestamp: expect.any(Date),
        },
      );
    });

    it('should process webhook successfully from PENDING to FAILED', async () => {
      const pendingPayment = {
        ...mockPaymentWithRelations,
        id: 1,
        status: PaymentStatus.PENDING,
      };
      const failedWebhookDto: WebhookDto = {
        ...webhookDto,
        status: PaymentStatus.FAILED,
      };
      const updatedPayment = {
        ...pendingPayment,
        status: PaymentStatus.FAILED,
        provider_transaction_id: 'TXN123',
      };

      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(pendingPayment);
      mockRepository.processWebhookTransaction.mockResolvedValue(updatedPayment);

      const result = await service.handleWebhook(failedWebhookDto);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.provider_transaction_id).toBe('TXN123');
      expect(mockRepository.processWebhookTransaction).toHaveBeenCalledWith(
        pendingPayment.id,
        {
          payment_reference_id: failedWebhookDto.payment_reference_id,
          status: failedWebhookDto.status,
          provider_transaction_id: failedWebhookDto.provider_transaction_id,
          timestamp: expect.any(Date),
        },
      );
    });

    it('should handle idempotency - return existing payment if webhook already processed', async () => {
      const existingWebhook = {
        id: 1,
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.SUCCESS,
        provider_transaction_id: 'TXN123',
        timestamp: new Date(),
        is_processed: true,
      };

      const processedPayment = {
        ...mockPaymentWithRelations,
        status: PaymentStatus.SUCCESS,
        provider_transaction_id: 'TXN123',
      };

      mockRepository.findWebhookEvent.mockResolvedValue(existingWebhook);
      mockRepository.findByReference.mockResolvedValue(processedPayment);

      const result = await service.handleWebhook(webhookDto);

      expect(result).toEqual(processedPayment);
      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(mockRepository.processWebhookTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(null);

      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        `Payment with reference ${webhookDto.payment_reference_id} not found`,
      );
    });

    it('should throw NotFoundException when webhook processed but payment not found', async () => {
      const existingWebhook = {
        id: 1,
        payment_reference_id: mockPayment.reference_id,
        status: PaymentStatus.SUCCESS,
        is_processed: true,
      };

      mockRepository.findWebhookEvent.mockResolvedValue(existingWebhook);
      mockRepository.findByReference.mockResolvedValue(null);

      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid state transition from INITIATED to SUCCESS', async () => {
      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(mockPayment);

      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        'Invalid state transition',
      );
    });

    it('should throw BadRequestException for invalid state transition from SUCCESS to PENDING', async () => {
      const successPayment = {
        ...mockPaymentWithRelations,
        status: PaymentStatus.SUCCESS,
      };
      const invalidWebhookDto: WebhookDto = {
        ...webhookDto,
        status: PaymentStatus.PENDING,
      };

      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(successPayment);

      await expect(service.handleWebhook(invalidWebhookDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid state transition from FAILED to SUCCESS', async () => {
      const failedPayment = {
        ...mockPaymentWithRelations,
        status: PaymentStatus.FAILED,
      };

      mockRepository.findWebhookEvent.mockResolvedValue(null);
      mockRepository.findByReference.mockResolvedValue(failedPayment);

      await expect(service.handleWebhook(webhookDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

