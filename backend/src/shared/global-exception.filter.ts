import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

type ErrorEnvelope = {
  error_code: string;
  message: string;
  details?: unknown;
  request_id?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId = (req as any).request_id ?? req.header('x-request-id');

    if (exception instanceof ZodError) {
      const body: ErrorEnvelope = {
        error_code: 'COMMON_VALIDATION_001',
        message: 'Validation failed',
        details: exception.issues,
        request_id: requestId,
      };
      return res.status(HttpStatus.BAD_REQUEST).json(body);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as any;
      const body: ErrorEnvelope = {
        error_code: response?.error_code ?? `COMMON_HTTP_${status}`,
        message: response?.message ?? exception.message,
        details: response?.details,
        request_id: requestId,
      };
      return res.status(status).json(body);
    }

    // Log unhandled exceptions with full details
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const errorStack = exception instanceof Error ? exception.stack : undefined;
    
    this.logger.error(
      `Unhandled exception: ${errorMessage}`,
      errorStack,
      {
        requestId,
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query,
        params: req.params,
        user: (req as any).user,
      },
    );

    const body: ErrorEnvelope = {
      error_code: 'COMMON_UNHANDLED_001',
      message: 'Internal server error',
      request_id: requestId,
    };

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}


