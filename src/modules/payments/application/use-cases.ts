import { desc } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import { getPaymentProvider, type WebhookEvent } from "./provider.ts";
import { MercadoPagoProvider } from "../infrastructure/mercadopago-provider.ts";
import { WebPayProvider } from "../infrastructure/webpay-provider.ts";
import * as repo from "../infrastructure/repository.ts";
import { type PaymentStatus } from "../domain/types.ts";
import { finalizePaymentAttemptFromProvider, recordPaymentEvent } from "./finalize.ts";
import { emitEventWithDb } from "../../../shared/infrastructure/outbox/worker.ts";
import { confirmReservationsForOrder } from "../../inventory/application/use-cases.ts";

export async function initiatePaymentUseCase(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}): Promise<{ attemptId: string; status: string }> {
  const existingActive = await repo.findLatestActivePaymentAttemptByOrderId(input.orderId);
  if (existingActive) return { attemptId: existingActive.id, status: existingActive.status };
  const existing = await repo.findPaymentAttemptByIdempotencyKey(input.idempotencyKey);
  if (existing) return { attemptId: existing.id, status: existing.status };

  const provider = getPaymentProvider();
  const result = await provider.createIntent(input);
  const attemptId = crypto.randomUUID();

  await getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.insertPaymentAttempt({
      id: attemptId,
      orderId: input.orderId,
      provider: provider.name,
      providerIntentId: result.providerIntentId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: result.status,
      idempotencyKey: input.idempotencyKey,
      metadata: result.metadata ?? null,
    }, t);

    await repo.insertPaymentTransaction({
      id: crypto.randomUUID(),
      attemptId,
      eventType: `intent_${result.status}`,
      providerEventId: result.providerIntentId ? `${result.providerIntentId}_event` : `${attemptId}_local_event`,
      payload: result.metadata ?? null,
      processedAt: new Date(),
    }, t);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "payment",
      aggregateId: attemptId,
      eventType: `payment_intent_${result.status}`,
      payload: { orderId: input.orderId, provider: provider.name },
      actorId: null,
      correlationId: null,
    });

    if (result.status === "approved") {
      await repo.updateOrderStatus(input.orderId, "confirmed", t);
      await confirmReservationsForOrder(input.orderId);
    }

    const order = await repo.findOrderById(input.orderId, t);
    await emitEventWithDb(tx, {
      aggregateType: "payment",
      aggregateId: attemptId,
      eventType: `payment_${result.status}`,
      payload: { orderId: input.orderId, customerEmail: order?.customerEmail ?? null },
    });
  });

  return { attemptId, status: result.status };
}

export async function handleWebhookUseCase(body: string, signature: string | null, requestId?: string, dataId?: string): Promise<{ processed: boolean; reason?: string }> {
  const provider = getPaymentProvider();
  let event = provider.parseWebhook(body, signature, requestId, dataId);
  if (!event) return { processed: false, reason: "invalid_payload" };

  if (event.metadata?.requiresFetch && provider instanceof MercadoPagoProvider) {
    const paymentId = String(event.metadata.paymentId ?? "");
    const result = await provider.fetchPaymentStatus(paymentId);
    if (!result) return { processed: false, reason: "fetch_failed" };
    event = {
      ...event,
      status: result.status,
      metadata: { ...event.metadata, ...result.metadata },
    };
    const orderId = (result.metadata as Record<string, unknown>)?.external_reference as string | undefined;
    if (orderId) {
      const attempt = await repo.findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (event.metadata?.requiresCommit && provider instanceof WebPayProvider) {
    const token = String(event.metadata.token ?? "");
    const result = await provider.commitTransaction(token);
    if (!result) return { processed: false, reason: "commit_failed" };
    event = {
      ...event,
      status: result.status,
      metadata: { ...event.metadata, ...result.metadata },
    };
    const orderId = event.orderId || ((event.metadata as Record<string, unknown>)?.order_id as string);
    if (orderId) {
      const attempt = await repo.findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (!event.attemptId) {
    const orderId = event.orderId || ((event.metadata as Record<string, unknown>)?.external_reference as string);
    if (orderId) {
      const attempt = await repo.findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (!event.attemptId) {
    return { processed: false, reason: "attempt_not_found_no_order" };
  }

  return processWebhookEvent(event);
}

async function processWebhookEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string }> {
  const attempt = await repo.findPaymentAttemptById(event.attemptId);
  if (!attempt) {
    await recordPaymentEvent({
      attemptId: event.attemptId,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      payload: event.raw,
    });
    return { processed: false, reason: "attempt_not_found" };
  }

  const newStatus = event.status as PaymentStatus;
  const validTransitions: Record<string, PaymentStatus[]> = {
    pending: ["processing", "approved", "failed"],
    processing: ["approved", "rejected", "failed"],
  };
  const allowed = validTransitions[attempt.status];

  if (allowed && allowed.includes(newStatus)) {
    const result = await finalizePaymentAttemptFromProvider({
      attemptId: attempt.id,
      newStatus,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      payload: event.raw,
    });
    return { processed: result.success, reason: result.reason };
  }

  await recordPaymentEvent({
    attemptId: attempt.id,
    eventType: event.eventType,
    providerEventId: event.providerEventId,
    payload: event.raw,
  });

  return { processed: true };
}

export async function getOrderPayments(orderId: string) {
  const attempts = await repo.findPaymentAttemptsByOrderId(orderId);
  const result = [];
  for (const a of attempts) {
    const transactions = await repo.findTransactionsByAttemptId(a.id);
    result.push({ ...a, transactions });
  }
  return result;
}

export async function getPaymentList() {
  const db = getDb();
  return db.select().from(s.paymentAttempts).orderBy(desc(s.paymentAttempts.createdAt));
}
