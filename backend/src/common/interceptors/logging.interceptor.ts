import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { tap } from 'rxjs';
import type { RequestWithId } from '../http/request-with-id.js';
import { AppLogger } from '../logger/app-logger.service.js';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(AppLogger) private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<RequestWithId>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            {
              level: 'info',
              requestId: req.requestId,
              method,
              path: originalUrl,
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
            },
            'HttpRequest',
          );
        },
        error: (error: unknown) => {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof error.status === 'number'
              ? error.status
              : 500;
          const errorDetails =
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { value: String(error) };
          const log =
            statusCode >= 500
              ? this.logger.error.bind(this.logger)
              : this.logger.warn.bind(this.logger);
          log(
            {
              level: statusCode >= 500 ? 'error' : 'warn',
              requestId: req.requestId,
              method,
              path: originalUrl,
              statusCode,
              durationMs: Date.now() - startedAt,
              error: errorDetails,
            },
            'HttpRequest',
          );
        },
      }),
    );
  }
}
