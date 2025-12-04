import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'Payment reference ID',
    example: 'REF-1234567890',
  })
  @IsString()
  @IsNotEmpty()
  payment_reference_id: string;

  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status: PaymentStatus;

  @ApiProperty({
    description: 'Provider transaction ID',
    required: false,
    example: 'TXN123456789',
  })
  @IsString()
  @IsOptional()
  provider_transaction_id?: string;
}

