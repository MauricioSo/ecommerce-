import { createApp } from "./src/web/app.ts";
import { closeDb, getPool } from "./src/shared/infrastructure/db/index.ts";
import { getConfig } from "./src/shared/infrastructure/config.ts";
import { createLogger } from "./src/shared/infrastructure/logger/index.ts";

const config = getConfig();
const logger = createLogger(config.LOG_LEVEL);

const app = createApp();
const server = app.listen({ port: config.PORT });

logger.info(`Server started on port ${config.PORT}`, { env: config.NODE_ENV, port: config.PORT });

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    server.stop();
    await closeDb();
    logger.info("Shutdown complete");
  } catch (e) {
    logger.error("Error during shutdown", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export type App = typeof app;
