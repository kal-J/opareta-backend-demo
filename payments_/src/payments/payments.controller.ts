import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { WebhookDto } from './dto/webhook.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(AuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate a payment',
    description:
      'Create a new payment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const createdPayment = await this.paymentsService.createPayment(createPaymentDto);
    return {
      ...createdPayment,
      payment_method: createdPayment.payment_method.name,
      currency: createdPayment.currency.name,
    };
  }

  @Get(':payment_reference_id')
  @ApiOperation({
    summary: 'Get payment by payment_reference_id',
    description: 'Retrieve payment details using the payment reference ID',
  })
  @ApiParam({
    name: 'payment_reference_id',
    description: 'Payment reference ID',
    example: 'PAY-1234567890-ABC123',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment found',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPaymentByReference(
    @Param('payment_reference_id') payment_reference_id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.getPaymentByReference(payment_reference_id);
    return {
      ...payment,
      payment_method: payment.payment_method.name,
      currency: payment.currency.name,
    };
  }

  @Post('/callback')
  @ApiOperation({
    summary: 'Update payment status',
    description:
      'Update the status of a payment (simulating provider callback).',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePaymentStatus(
    @Body() updateDto: UpdatePaymentStatusDto,
  ): Promise<PaymentResponseDto> {
    const updatedPayment = await this.paymentsService.updatePaymentStatus(updateDto);
    return {
      ...updatedPayment,
      payment_method: updatedPayment.payment_method.name,
      currency: updatedPayment.currency.name,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary: 'Handle payment webhook',
    description:
      'Receive payment status updates from payment provider. Implements idempotency to prevent duplicate processing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook data or state transition' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async handleWebhook(@Body() webhookDto: WebhookDto): Promise<PaymentResponseDto> {
    const updatedPayment = await this.paymentsService.handleWebhook(webhookDto);
    return {
      ...updatedPayment,
      payment_method: updatedPayment.payment_method.name,
      currency: updatedPayment.currency.name,
    };
  }
}

