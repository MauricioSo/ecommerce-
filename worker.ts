import { registerEventHandler, processOutboxBatch } from "../shared/infrastructure/outbox/worker.ts";
import { handleOutboxEvent } from "../modules/notifications/application/outbox-handler.ts";
import { getConfig } from "../shared/infrastructure/config.ts";

registerEventHandler(handleOutboxEvent);

const config = getConfig();
const POLL_INTERVAL_MS = 5000;

console.log(JSON.stringify({
  level: "info",
  timestamp: new Date().toISOString(),
  message: `Outbox worker started. Polling every ${POLL_INTERVAL_MS}ms`,
}));

async function run() {
  try {
    const result = await processOutboxBatch(50);
    if (result.processed > 0 || result.failed > 0) {
      console.log(JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message: `Outbox batch processed=${result.processed} failed=${result.failed}`,
      }));
    }
  } catch (e) {
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message: `Outbox worker error: ${(e as Error).message}`,
    }));
  }
}

setInterval(run, POLL_INTERVAL_MS);
run();
