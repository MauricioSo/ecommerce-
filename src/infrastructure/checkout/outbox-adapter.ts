import { emitEventWithDb } from "../../shared/infrastructure/outbox/worker.ts";
import type { OutboxPort } from "../../application/checkout/ports/outbox-port.ts";

export class OutboxAdapter implements OutboxPort {
  async emitEvent(tx: unknown, input: { aggregateType: string; aggregateId: string; eventType: string; payload?: Record<string, unknown> }) {
    await emitEventWithDb(tx, input);
  }
}
