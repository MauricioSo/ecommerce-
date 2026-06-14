import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import { emitEventWithDb } from "../../shared/infrastructure/outbox/worker.ts";
import { confirmReservationsForOrder } from "../../application/inventory/use-cases.ts";
import type { PaymentWorkflow } from "../../application/payments/ports/payment-workflow.ts";
import * as repo from "./repository.ts";

export class DrizzlePaymentWorkflow implements PaymentWorkflow {
  async createIntentAttempt(input: Parameters<PaymentWorkflow["createIntentAttempt"]>[0]): Promise<void> {
    await getDb().transaction(async (tx) => {
      const t = repo.asDb(tx);
      await repo.insertPaymentAttempt({
        id: input.attemptId,
        orderId: input.orderId,
        provider: input.providerName,
        providerIntentId: input.result.providerIntentId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: input.result.status,
        idempotencyKey: input.idempotencyKey,
        metadata: input.result.metadata ?? null,
      }, t);

      await repo.insertPaymentTransaction({
        id: crypto.randomUUID(),
        attemptId: input.attemptId,
        eventType: `intent_${input.result.status}`,
        providerEventId: input.result.providerIntentId ? `${input.result.providerIntentId}_event` : `${input.attemptId}_local_event`,
        payload: input.result.metadata ?? null,
        processedAt: new Date(),
      }, t);

      await tx.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "payment",
        aggregateId: input.attemptId,
        eventType: `payment_intent_${input.result.status}`,
        payload: { orderId: input.orderId, provider: input.providerName },
        actorId: null,
        correlationId: null,
      });

      if (input.result.status === "approved") {
        await repo.updateOrderStatus(input.orderId, "confirmed", t);
        await confirmReservationsForOrder(input.orderId);
      } else if (input.result.status === "failed" || input.result.status === "rejected") {
        await repo.updateOrderStatus(input.orderId, "payment_failed", t);
      } else {
        await repo.updateOrderStatus(input.orderId, "awaiting_payment", t);
      }

      const order = await repo.findOrderById(input.orderId, t);
      await emitEventWithDb(tx, {
        aggregateType: "payment",
        aggregateId: input.attemptId,
        eventType: `payment_${input.result.status}`,
        payload: { orderId: input.orderId, customerEmail: order?.customerEmail ?? null },
      });
    });
  }
}
