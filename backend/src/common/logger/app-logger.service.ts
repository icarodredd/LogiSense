import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

function toArgs(
  message: unknown,
  context?: string,
): [obj: Record<string, unknown>, msg?: string] {
  if (typeof message === 'object' && message !== null) {
    return [{ ...(message as Record<string, unknown>), context }];
  }
  return [{ context }, String(message)];
}

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true },
            },
          }),
    });
  }

  log(message: unknown, context?: string) {
    const [obj, msg] = toArgs(message, context);
    this.logger.info(obj, msg);
  }

  error(message: unknown, trace?: unknown, context?: string) {
    const [obj, msg] = toArgs(message, context);
    this.logger.error({ ...obj, trace }, msg);
  }

  warn(message: unknown, context?: string) {
    const [obj, msg] = toArgs(message, context);
    this.logger.warn(obj, msg);
  }

  debug(message: unknown, context?: string) {
    const [obj, msg] = toArgs(message, context);
    this.logger.debug(obj, msg);
  }

  verbose(message: unknown, context?: string) {
    const [obj, msg] = toArgs(message, context);
    this.logger.trace(obj, msg);
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}
