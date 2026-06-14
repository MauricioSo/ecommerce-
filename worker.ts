import { registerEventHandler, processOutboxBatch } from "./src/shared/infrastructure/outbox/worker.ts";
import { createOutboxEventHandler } from "./src/application/notifications/outbox-handler.ts";
import { getNotificationSender } from "./src/infrastructure/notifications/sender.ts";
import { expireReservationsJob } from "./src/application/inventory/use-cases.ts";
import { failStalePendingPayments, reconcileOrphanedPayments } from "./src/application/payments/reconciliation.ts";
import { getConfig } from "./src/shared/infrastructure/config.ts";
import { createLogger } from "./src/shared/infrastructure/logger/index.ts";

const notificationSender = getNotificationSender();
registerEventHandler(createOutboxEventHandler(notificationSender));

const config = getConfig();
const logger = createLogger(config.LOG_LEVEL);
const POLL_INTERVAL_MS = 5000;
const RECONCILIATION_INTERVAL_MS = 60_000;
let lastReconciliationAt = 0;

logger.info(`Outbox worker started. Polling every ${POLL_INTERVAL_MS}ms`);

async function run() {
  try {
    const result = await processOutboxBatch(50);
    if (result.processed > 0 || result.failed > 0) {
      logger.info(`Outbox batch complete`, { processed: result.processed, failed: result.failed });
    }
    const expired = await expireReservationsJob();
    if (expired > 0) {
      logger.info(`Expired inventory reservations`, { count: expired });
    }
    if (Date.now() - lastReconciliationAt >= RECONCILIATION_INTERVAL_MS) {
      lastReconciliationAt = Date.now();
      const [orphans, stale] = await Promise.all([
        reconcileOrphanedPayments(),
        failStalePendingPayments(60),
      ]);
      if (orphans.fixed > 0 || orphans.errors > 0 || stale.failed > 0 || stale.errors > 0) {
        logger.info("Payment reconciliation complete", { orphanedFixed: orphans.fixed, orphanedErrors: orphans.errors, staleFailed: stale.failed, staleErrors: stale.errors });
      }
    }
  } catch (e) {
    logger.error(`Outbox worker error`, { error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : { message: String(e) } });
  }
}

setInterval(run, POLL_INTERVAL_MS);
run();

async function workerShutdown(signal: string) {
  logger.info(`${signal} received, shutting down worker`);
  process.exit(0);
}

process.on("SIGTERM", () => workerShutdown("SIGTERM"));
process.on("SIGINT", () => workerShutdown("SIGINT"));
