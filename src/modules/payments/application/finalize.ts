import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";
import { emitEventWithDb } from "../../../shared/infrastructure/outbox/worker.ts";
import { confirmReservationsForOrder } from "../../inventory/application/use-cases.ts";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["processing", "approved", "failed", "rejected"],
  processing: ["approved", "failed", "rejected"],
};

export async function finalizePaymentAttemptFromProvider(input: {
  attemptId: string;
  newStatus: string;
  eventType: string;
  providerEventId: string;
  payload: Record<string, unknown>;
}): Promise<{ success: boolean; reason?: string }> {
  return getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);

    const txResult = await tx.insert(s.paymentTransactions)
      .values({
        id: crypto.randomUUID(),
        attemptId: input.attemptId,
        eventType: input.eventType,
        providerEventId: input.providerEventId,
        payload: input.payload,
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: s.paymentTransactions.providerEventId })
      .returning();

    if (txResult.length === 0) {
      return { success: true, reason: "already_processed" };
    }

    const attempt = await repo.findPaymentAttemptById(input.attemptId, t);
    if (!attempt) return { success: false, reason: "attempt_not_found" };

    const allowed = VALID_TRANSITIONS[attempt.status];
    if (!allowed || !allowed.includes(input.newStatus)) {
      return { success: false, reason: "invalid_transition" };
    }

    await repo.updatePaymentAttempt(input.attemptId, { status: input.newStatus }, t);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "payment",
      aggregateId: input.attemptId,
      eventType: `payment_${input.eventType}_${input.newStatus}`,
      payload: { orderId: attempt.orderId, from: attempt.status, to: input.newStatus },
      actorId: null,
      correlationId: null,
    });

    if (input.newStatus === "approved") {
      await repo.updateOrderStatus(attempt.orderId, "confirmed", t);
      await confirmReservationsForOrder(attempt.orderId);
    }

    const order = await repo.findOrderById(attempt.orderId, t);
    await emitEventWithDb(tx, {
      aggregateType: "payment",
      aggregateId: input.attemptId,
      eventType: `payment_${input.newStatus}`,
      payload: { orderId: attempt.orderId, customerEmail: order?.customerEmail ?? null },
    });

    return { success: true };
  });
}

export async function recordPaymentEvent(input: {
  attemptId: string;
  eventType: string;
  providerEventId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(s.paymentTransactions)
    .values({
      id: crypto.randomUUID(),
      attemptId: input.attemptId,
      eventType: input.eventType,
      providerEventId: input.providerEventId,
      payload: input.payload,
      processedAt: new Date(),
    })
    .onConflictDoNothing({ target: s.paymentTransactions.providerEventId });
}
