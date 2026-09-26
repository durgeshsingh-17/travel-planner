import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export type RequestWithId = Request & { requestId?: string };

/**
 * Tags every request with an id (reusing a well-formed incoming `X-Request-Id`
 * from a proxy) and logs one line per request once the response finishes.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    const startedAt = process.hrtime.bigint();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = JSON.stringify({
        requestId,
        method: request.method,
        // Path only: query strings can carry personal data (names, coordinates).
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(durationMs)
      });

      if (response.statusCode >= 500) {
        this.logger.error(line);
      } else if (process.env.NODE_ENV !== 'test') {
        this.logger.log(line);
      }
    });

    next();
  }
}
