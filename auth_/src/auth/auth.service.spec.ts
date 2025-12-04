import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let repository: AuthRepository;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    phone_number: '+256700000000',
    email: 'test@example.com',
    password: 'hashedPassword123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUserWithoutEmail = {
    id: 2,
    phone_number: '+256700000001',
    email: null,
    password: 'hashedPassword123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    findByPhoneNumber: jest.fn(),
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: mockRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get<AuthRepository>(AuthRepository);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      phone_number: '+256700000000',
      email: 'test@example.com',
      password: 'password123',
    };

    it('should register a new user successfully with email', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(null);
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      // Mock bcrypt.hash
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('phone_number');
      expect(result).toHaveProperty('email');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user_id).toBe(mockUser.id);
      expect(result.phone_number).toBe(registerDto.phone_number);
      expect(result.email).toBe(registerDto.email);
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        registerDto.phone_number,
      );
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockRepository.createUser).toHaveBeenCalledWith({
        email: registerDto.email,
        phone_number: registerDto.phone_number,
        password: 'hashedPassword123',
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        phone_number: mockUser.phone_number,
      });
    });

    it('should register a new user successfully without email', async () => {
      const registerDtoNoEmail: RegisterDto = {
        phone_number: '+256700000001',
        password: 'password123',
      };

      mockRepository.findByPhoneNumber.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(mockUserWithoutEmail);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      const result = await service.register(registerDtoNoEmail);

      expect(result).toHaveProperty('access_token');
      expect(result.user_id).toBe(mockUserWithoutEmail.id);
      expect(result.phone_number).toBe(registerDtoNoEmail.phone_number);
      expect(result.email).toBeUndefined();
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        registerDtoNoEmail.phone_number,
      );
      expect(mockRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockRepository.createUser).toHaveBeenCalledWith({
        email: undefined,
        phone_number: registerDtoNoEmail.phone_number,
        password: 'hashedPassword123',
      });
    });

    it('should throw ConflictException when phone number already exists', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this phone number already exists',
      );
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        registerDto.phone_number,
      );
      expect(mockRepository.createUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(null);
      mockRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this email already exists',
      );
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        registerDto.phone_number,
      );
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockRepository.createUser).not.toHaveBeenCalled();
    });

    it('should hash password before saving', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(null);
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.createUser.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');
      const hashSpy = bcrypt.hash as jest.Mock;

      await service.register(registerDto);

      expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashedPassword123',
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      phone_number: '+256700000000',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('phone_number');
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user_id).toBe(mockUser.id);
      expect(result.phone_number).toBe(mockUser.phone_number);
      expect(result.email).toBe(mockUser.email);
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        loginDto.phone_number,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        phone_number: mockUser.phone_number,
      });
    });

    it('should login successfully with user without email', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(mockUserWithoutEmail);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result.email).toBeUndefined();
      expect(result.phone_number).toBe(mockUserWithoutEmail.phone_number);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid phone number or password',
      );
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        loginDto.phone_number,
      );
      expect(bcrypt.compare as jest.Mock).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockRepository.findByPhoneNumber.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid phone number or password',
      );
      expect(mockRepository.findByPhoneNumber).toHaveBeenCalledWith(
        loginDto.phone_number,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    const validToken = 'valid-jwt-token';
    const invalidToken = 'invalid-jwt-token';

    it('should verify token successfully when token is valid and user exists', async () => {
      const payload = { sub: mockUser.id, phone_number: mockUser.phone_number };
      mockJwtService.verify.mockReturnValue(payload);
      mockRepository.findById.mockResolvedValue(mockUser);

      const result = await service.verifyToken(validToken);

      expect(result.valid).toBe(true);
      expect(result.user_id).toBe(mockUser.id);
      expect(result.error).toBeUndefined();
      expect(mockJwtService.verify).toHaveBeenCalledWith(validToken);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return invalid when token is valid but user not found', async () => {
      const payload = { sub: 999, phone_number: '+256700000000' };
      mockJwtService.verify.mockReturnValue(payload);
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.verifyToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('User not found');
      expect(result.user_id).toBeUndefined();
      expect(mockJwtService.verify).toHaveBeenCalledWith(validToken);
      expect(mockRepository.findById).toHaveBeenCalledWith(999);
    });

    it('should return invalid when token is invalid (JWT error)', async () => {
      const jwtError = new Error('Token expired');
      mockJwtService.verify.mockImplementation(() => {
        throw jwtError;
      });

      const result = await service.verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.user_id).toBeUndefined();
      expect(mockJwtService.verify).toHaveBeenCalledWith(invalidToken);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should return invalid when token verification throws error without message', async () => {
      const jwtError = new Error();
      mockJwtService.verify.mockImplementation(() => {
        throw jwtError;
      });

      const result = await service.verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
      expect(result.user_id).toBeUndefined();
    });

    it('should handle non-Error exceptions', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw 'String error';
      });

      const result = await service.verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('validateUser', () => {
    it('should return user when user exists', async () => {
      mockRepository.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.validateUser(999)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(999)).rejects.toThrow('User not found');
      expect(mockRepository.findById).toHaveBeenCalledWith(999);
    });
  });
});

