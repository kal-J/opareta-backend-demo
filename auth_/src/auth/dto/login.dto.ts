import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phone_number: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}
