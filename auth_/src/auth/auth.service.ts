import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  VerifyTokenResponseDto,
} from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) { }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUserByPhone = await this.authRepository.findByPhoneNumber(
      registerDto.phone_number,
    );
    if (existingUserByPhone) {
      throw new ConflictException('User with this phone number already exists');
    }

    if (registerDto.email) {
      const existingUserByEmail = await this.authRepository.findByEmail(
        registerDto.email,
      );
      if (existingUserByEmail) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.authRepository.createUser({
      email: registerDto.email,
      phone_number: registerDto.phone_number,
      password: hashedPassword,
    });

    const payload = { sub: user.id, phone_number: user.phone_number };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user_id: user.id,
      email: user.email || undefined,
      phone_number: user.phone_number,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findByPhoneNumber(
      loginDto.phone_number,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const payload = { sub: user.id, phone_number: user.phone_number };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user_id: user.id,
      email: user.email || undefined,
      phone_number: user.phone_number,
    };
  }

  async verifyToken(token: string): Promise<VerifyTokenResponseDto> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.authRepository.findById(payload.sub);

      if (!user) {
        return {
          valid: false,
          error: 'User not found',
        };
      }

      return {
        valid: true,
        user_id: user.id,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Invalid token',
      };
    }
  }

  async validateUser(userId: number) {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
