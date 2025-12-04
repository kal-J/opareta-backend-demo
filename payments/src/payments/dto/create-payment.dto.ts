import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Payment amount',
    example: 1000.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(400)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'UGX',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'MOBILE_MONEY',
  })
  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+256700000000',
  })
  @IsString()
  @IsNotEmpty()
  customer_phone: string;

  @ApiProperty({
    description: 'Customer email address',
    example: 'customer@example.com',
    required: false,
  })
  @IsEmail()
  customer_email?: string;
}

