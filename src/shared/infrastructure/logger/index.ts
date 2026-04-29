export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const LEVEL_PRIORITY: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(level: string = "info"): Logger {
  const priority = LEVEL_PRIORITY[level] ?? 1;

  function emit(lvl: string, msg: string, meta?: Record<string, unknown>) {
    if ((LEVEL_PRIORITY[lvl] ?? 0) < priority) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      message: msg,
      ...meta,
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
