import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import { RequestWithId } from '../middleware/request-context.middleware';

interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(rawException: unknown, host: ArgumentsHost): void {
    const exception = this.translatePrismaError(rawException);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & RequestWithId>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.requestId ?? '-'}] ${
          exception instanceof Error ? exception.message : 'Unhandled exception'
        }`,
        exception instanceof Error ? exception.stack : undefined
      );
    }

    const body: ApiErrorBody = {
      success: false,
      error: {
        code: this.resolveCode(status),
        message: this.resolveMessage(exceptionResponse),
        details: this.resolveDetails(exceptionResponse),
        requestId: request.requestId
      }
    };

    response.status(status).json(body);
  }

  /** Known database errors become client errors instead of opaque 500s. */
  private translatePrismaError(exception: unknown): unknown {
    if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
      return exception;
    }

    if (exception.code === 'P2025') {
      return new NotFoundException('The requested record no longer exists');
    }

    if (exception.code === 'P2002') {
      return new ConflictException('A record with these details already exists');
    }

    if (exception.code === 'P2003') {
      return new BadRequestException('A referenced record does not exist');
    }

    return exception;
  }

  private resolveCode(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return 'BAD_REQUEST';
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return 'UNAUTHORIZED';
    }

    if (status === HttpStatus.FORBIDDEN) {
      return 'FORBIDDEN';
    }

    if (status === HttpStatus.NOT_FOUND) {
      return 'NOT_FOUND';
    }

    if (status === HttpStatus.CONFLICT) {
      return 'CONFLICT';
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return 'RATE_LIMITED';
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
