import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Response } from 'express';

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const body: ApiErrorBody = {
      success: false,
      error: {
        code: this.resolveCode(status),
        message: this.resolveMessage(exceptionResponse),
        details: this.resolveDetails(exceptionResponse)
      }
    };

    response.status(status).json(body);
  }

  private resolveCode(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return 'BAD_REQUEST';
    }

    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND';
    }

    return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED';
  }

  private resolveMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const message = (exceptionResponse as { message: unknown }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    return 'Something went wrong';
  }

  private resolveDetails(exceptionResponse: unknown): unknown {
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'error' in exceptionResponse
    ) {
      return (exceptionResponse as { error: unknown }).error;
    }

    return undefined;
  }
}
