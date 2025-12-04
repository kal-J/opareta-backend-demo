import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class WebhookDto {
  @ApiProperty({
    description: 'Payment reference ID',
    example: 'REF-1234567890',
  })
  @IsString()
  @IsNotEmpty()
  payment_reference_id: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status: PaymentStatus;

  @ApiProperty({
    description: 'Provider transaction ID',
    example: 'TXN123456789',
  })
  @IsString()
  @IsNotEmpty()
  provider_transaction_id: string;

  @ApiProperty({
    description: 'Webhook timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  timestamp: string;
}

