import { AsyncLocalStorage } from "node:async_hooks";

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const logContext = new AsyncLocalStorage<LogContext>();

export function getCorrelationId(): string | undefined {
  return logContext.getStore()?.correlationId as string | undefined;
}

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return logContext.run(ctx, fn);
}

const REDACT_KEYS = new Set([
  "password", "passwordhash", "passwordconfirm", "token", "secret",
  "email", "phone", "taxid", "documentnumber", "creditcard",
  "authorization", "cookie", "set-cookie",
]);

export function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (REDACT_KEYS.has(lower)) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redact(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

export function createLogger(level: string = "info"): Logger {
  const priority = LEVEL_PRIORITY[level] ?? 1;

  function emit(lvl: string, msg: string, meta?: Record<string, unknown>) {
    if ((LEVEL_PRIORITY[lvl] ?? 0) < priority) return;
    const store = logContext.getStore();
    const redactedMeta = meta ? redact(meta) as Record<string, unknown> : {};
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message: msg,
      ...(store?.correlationId ? { correlationId: store.correlationId } : {}),
      ...redactedMeta,
    };
    const line = JSON.stringify(entry);
    if (lvl === "error") console.error(line);
    else if (lvl === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (msg, meta) => emit("debug", msg, meta),
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
  };
}
