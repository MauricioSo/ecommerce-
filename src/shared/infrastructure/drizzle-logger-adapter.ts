import type { LoggerPort } from "../application/ports/logger.ts";
import { createLogger } from "./logger/index.ts";

export class DrizzleLoggerAdapter implements LoggerPort {
  private logger;

  constructor(level?: string) {
    this.logger = createLogger(level);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }
}
