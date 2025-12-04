import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class AccessLoggerInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AccessLoggerInterceptor.name);

    // List of sensitive field names to mask
    private readonly sensitiveFields = [
        'password',
        'token',
        'authorization',
        'accessToken',
        'access_token',
        'phone_number',
        'customer_phone',
        'customer_email',
        'email',
    ];

    // Fields to partially mask (show first/last few characters)
    private readonly partialMaskFields = [
        'customer_phone',
        'phone',
        'phone_number',
    ];

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const { method, url, body, query, params, headers } = request;
        const startTime = Date.now();

        // Mask sensitive data in request
        const sanitizedBody = this.sanitizeData(body);
        const sanitizedHeaders = this.sanitizeHeaders(headers);
        const sanitizedQuery = this.sanitizeData(query);
        const sanitizedParams = this.sanitizeData(params);

        // Log incoming request
        this.logger.log(
            `Incoming Request: ${method} ${url} - Body: ${JSON.stringify(sanitizedBody)} - Query: ${JSON.stringify(sanitizedQuery)} - Params: ${JSON.stringify(sanitizedParams)} - Headers: ${JSON.stringify(sanitizedHeaders)}`,
        );

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const responseTime = Date.now() - startTime;
                    const sanitizedResponse = this.sanitizeData(data);
                    const statusCode = response.statusCode || 200;

                    this.logger.log(
                        `Outgoing Response: ${method} ${url} - Status: ${statusCode} - ResponseTime: ${responseTime}ms - Body: ${JSON.stringify(sanitizedResponse)}`,
                    );
                },
            }),
            catchError((error) => {
                const responseTime = Date.now() - startTime;
                const statusCode = error?.status || error?.statusCode || response.statusCode || 500;
                const errorMessage = error?.message || 'Unknown error';
                const errorStack = error?.stack ? ` - Stack: ${error.stack.substring(0, 200)}` : '';

                this.logger.error(
                    `Request Error: ${method} ${url} - Status: ${statusCode} - ResponseTime: ${responseTime}ms - Error: ${errorMessage}${errorStack}`,
                );

                // Re-throw the error so it can be handled by exception filters
                return throwError(() => error);
            }),
            finalize(() => {
                // Additional cleanup or logging can be done here if needed
            }),
        );
    }

    private sanitizeData(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.sanitizeData(item));
        }

        const sanitized: any = {};

        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();

            // Check if field should be completely masked
            if (this.shouldMaskField(lowerKey)) {
                if (this.partialMaskFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
                    sanitized[key] = this.partialMask(value as string);
                } else {
                    sanitized[key] = '***MASKED***';
                }
            } else if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private sanitizeHeaders(headers: any): any {
        if (!headers || typeof headers !== 'object') {
            return headers;
        }

        const sanitized: any = {};

        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();

            // Mask authorization and other sensitive headers
            if (
                lowerKey === 'authorization' ||
                lowerKey === 'cookie' ||
                lowerKey.includes('token') ||
                lowerKey.includes('secret') ||
                lowerKey.includes('auth')
            ) {
                if (typeof value === 'string' && value.length > 0) {
                    // Show first few characters and mask the rest
                    sanitized[key] = this.partialMask(value as string, 8);
                } else {
                    sanitized[key] = '***MASKED***';
                }
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private shouldMaskField(fieldName: string): boolean {
        return this.sensitiveFields.some((sensitiveField) =>
            fieldName.includes(sensitiveField.toLowerCase()),
        );
    }

    private partialMask(value: string, visibleChars: number = 4): string {
        if (!value || typeof value !== 'string') {
            return '***MASKED***';
        }

        if (value.length <= visibleChars * 2) {
            return '***MASKED***';
        }

        const start = value.substring(0, visibleChars);
        const end = value.substring(value.length - visibleChars);
        const maskedLength = value.length - visibleChars * 2;
        const masked = '*'.repeat(Math.min(maskedLength, 8));

        return `${start}${masked}${end}`;
    }
}

