import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import Axios from 'axios';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('Public route, skipping authentication');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException('No token provided');
    }

    try {
      const authServiceUrl =
        this.configService.get<string>('AUTH_SERVICE_URL')
      const verifyEndpoint = `${authServiceUrl}/auth/verify`;

      this.logger.debug(`Verifying token with auth service: ${verifyEndpoint}`);

      const response = await Axios.post(
        verifyEndpoint,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      ).catch((error) => {
        this.logger.error(`Token verification error: ${error.message}`);
        throw new UnauthorizedException('Token verification failed');
      });

      if (response.data && response.data.valid) {
        request.user = response.data.user || {};
        this.logger.debug('Token verified successfully');
        return true;
      }

      this.logger.warn('Token verification failed: invalid token');
      throw new UnauthorizedException('Invalid token');
    } catch (error) {
      this.logger.error(
        `Token verification error: ${error.message}`,
        error.stack,
      );
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] =
      request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

