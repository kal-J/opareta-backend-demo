import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
    statusCode: number;
    timestamp: string;
    path: string;
    message: string | string[];
    error?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: number;
        let message: string | string[];
        let error: string | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse as any;
                message = responseObj.message || exception.message;
                error = responseObj.error;
            } else {
                message = exception.message;
            }

        } else if (exception instanceof Error) {
            // Handle Prisma errors
            if (this.isPrismaError(exception)) {
                const prismaError = this.handlePrismaError(exception);
                status = prismaError.status;
                message = prismaError.message;
                error = prismaError.error;
            } else {
                // Generic error
                status = HttpStatus.INTERNAL_SERVER_ERROR;
                message = 'An unexpected error occurred. Please try again later.';
                error = 'Internal Server Error';
            }
        } else {
            // Unknown error type
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'An unexpected error occurred. Please try again later.';
            error = 'Internal Server Error';
        }

        const errorResponse: ErrorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
            ...(error && { error }),
        };

        // Log error details with request information
        const requestInfo = {
            method: request.method,
            url: request.url,
            status,
            message: Array.isArray(message) ? message.join(', ') : message,
            error,
            ip: request.ip || request.connection?.remoteAddress,
            userAgent: request.get('user-agent'),
        };

        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${request.url} - Status: ${status} - ${JSON.stringify(requestInfo)}`,
                exception instanceof Error ? exception.stack : JSON.stringify(exception),
            );
        } else {
            this.logger.warn(
                `${request.method} ${request.url} - Status: ${status} - ${JSON.stringify(requestInfo)}`,
            );
        }

        response.status(status).json(errorResponse);
    }

    private isPrismaError(error: Error): boolean {
        return (
            error.name === 'PrismaClientKnownRequestError' ||
            error.name === 'PrismaClientUnknownRequestError' ||
            error.name === 'PrismaClientRustPanicError' ||
            error.name === 'PrismaClientInitializationError' ||
            error.name === 'PrismaClientValidationError' ||
            error.constructor.name.includes('Prisma')
        );
    }

    private handlePrismaError(error: any): {
        status: number;
        message: string;
        error?: string;
    } {
        // Handle known Prisma errors
        if (error.code === 'P2002') {
            return {
                status: HttpStatus.CONFLICT,
                message: 'A record with this information already exists.',
                error: 'Unique Constraint Violation',
            };
        }

        if (error.code === 'P2025') {
            return {
                status: HttpStatus.NOT_FOUND,
                message: 'The requested record was not found.',
                error: 'Record Not Found',
            };
        }

        if (error.code === 'P2003') {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: 'Invalid reference to a related record.',
                error: 'Foreign Key Constraint Violation',
            };
        }

        if (error.code === 'P2014') {
            return {
                status: HttpStatus.BAD_REQUEST,
                message: 'Invalid relationship between records.',
                error: 'Relation Violation',
            };
        }

        // Generic Prisma error
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'A database error occurred. Please try again later.',
            error: 'Database Error',
        };
    }
}

