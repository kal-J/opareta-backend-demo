import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {

  @ApiProperty({ description: 'Unique payment reference' })
  reference_id: string;

  @ApiProperty({ description: 'Customer phone number' })
  customer_phone: string;

  @ApiProperty({ description: 'Customer email', required: false, nullable: true })
  customer_email?: string | null;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ description: 'Payment method' })
  payment_method: string;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Provider transaction ID', required: false, nullable: true })
  provider_transaction_id?: string | null;

  @ApiProperty({ description: 'Provider name', required: false, nullable: true })
  provider_name?: string | null;

  @ApiProperty({ description: 'Payment creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Payment last update timestamp' })
  updated_at: Date;
}


