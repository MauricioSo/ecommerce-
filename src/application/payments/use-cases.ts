import { getPaymentProvider, type WebhookEvent } from "./provider.ts";
import { type PaymentStatus } from "../../domain/payments/types.ts";
import { finalizePaymentAttemptFromProvider, recordPaymentEvent } from "./finalize.ts";
import type { PaymentRepository } from "./ports/payment-repository.ts";
import type { PaymentWorkflow } from "./ports/payment-workflow.ts";

let paymentRepository: PaymentRepository | null = null;
let paymentWorkflow: PaymentWorkflow | null = null;

export function setPaymentUseCaseDependencies(deps: { repository: PaymentRepository; workflow: PaymentWorkflow }): void {
  paymentRepository = deps.repository;
  paymentWorkflow = deps.workflow;
}

function repo(): PaymentRepository {
  if (!paymentRepository) throw new Error("PaymentRepository dependency was not configured");
  return paymentRepository;
}

function workflow(): PaymentWorkflow {
  if (!paymentWorkflow) throw new Error("PaymentWorkflow dependency was not configured");
  return paymentWorkflow;
}

export async function initiatePaymentUseCase(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}): Promise<{ attemptId: string; status: string }> {
  const r = repo();
  const existingActive = await r.findLatestActivePaymentAttemptByOrderId(input.orderId);
  if (existingActive) return { attemptId: existingActive.id, status: existingActive.status };
  const existing = await r.findPaymentAttemptByIdempotencyKey(input.idempotencyKey);
  if (existing) return { attemptId: existing.id, status: existing.status };

  const provider = getPaymentProvider();
  const result = await provider.createIntent(input);
  const attemptId = crypto.randomUUID();

  await workflow().createIntentAttempt({
    attemptId,
    orderId: input.orderId,
    providerName: provider.name,
    amountCents: input.amountCents,
    currency: input.currency,
    idempotencyKey: input.idempotencyKey,
    result,
  });

  return { attemptId, status: result.status };
}

export async function handleWebhookUseCase(body: string, signature: string | null, requestId?: string, dataId?: string): Promise<{ processed: boolean; reason?: string }> {
  const provider = getPaymentProvider();
  let event = await provider.parseWebhook(body, signature, requestId, dataId);
  if (!event) return { processed: false, reason: "invalid_payload" };

  if (event.metadata?.requiresFetch && provider.fetchExternalStatus) {
    const paymentId = String(event.metadata.paymentId ?? "");
    const result = await provider.fetchExternalStatus(paymentId);
    if (!result) return { processed: false, reason: "fetch_failed" };
    const resultMeta = result.metadata ?? {};
    event = {
      ...event,
      providerEventId: `mp_${paymentId}_${result.status}`,
      orderId: String((resultMeta as Record<string, unknown>).external_reference ?? event.orderId ?? ""),
      status: result.status,
      amountCents: Math.round(Number((resultMeta as Record<string, unknown>).transaction_amount ?? 0) * 100),
      currency: String((resultMeta as Record<string, unknown>).currency_id ?? event.currency ?? ""),
      metadata: { ...event.metadata, ...resultMeta },
    };
    const orderId = (resultMeta as Record<string, unknown>)?.external_reference as string | undefined;
    if (orderId) {
      const attempt = await repo().findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (event.metadata?.requiresCommit && provider.commitReturn) {
    const token = String(event.metadata.token ?? "");
    const result = await provider.commitReturn(token);
    if (!result) return { processed: false, reason: "commit_failed" };
    const resultMeta = result.metadata ?? {};
    event = {
      ...event,
      providerEventId: `webpay_commit_${token}`,
      status: result.status,
      amountCents: Math.round(Number((resultMeta as Record<string, unknown>).amount ?? 0) * 100),
      currency: "CLP",
      metadata: { ...event.metadata, ...resultMeta },
    };
    const orderId = event.orderId || ((event.metadata as Record<string, unknown>)?.order_id as string);
    if (orderId) {
      const attempt = await repo().findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (!event.attemptId) {
    const orderId = event.orderId || ((event.metadata as Record<string, unknown>)?.external_reference as string);
    if (orderId) {
      const attempt = await repo().findLatestActivePaymentAttemptByOrderId(orderId);
      if (attempt) event.attemptId = attempt.id;
    }
  }

  if (!event.attemptId) {
    return { processed: false, reason: "attempt_not_found_no_order" };
  }

  return processWebhookEvent(event);
}

async function processWebhookEvent(event: WebhookEvent): Promise<{ processed: boolean; reason?: string }> {
  const attempt = await repo().findPaymentAttemptById(event.attemptId);
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
  if (event.orderId && event.orderId !== attempt.orderId) {
    await recordPaymentEvent({
      attemptId: attempt.id,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      payload: { ...event.raw, rejectionReason: "order_mismatch" },
    });
    return { processed: false, reason: "order_mismatch" };
  }

  if (event.amountCents > 0 && event.amountCents !== attempt.amountCents) {
    await recordPaymentEvent({
      attemptId: attempt.id,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      payload: { ...event.raw, rejectionReason: "amount_mismatch" },
    });
    return { processed: false, reason: "amount_mismatch" };
  }

  if (event.currency && event.currency !== attempt.currency) {
    await recordPaymentEvent({
      attemptId: attempt.id,
      eventType: event.eventType,
      providerEventId: event.providerEventId,
      payload: { ...event.raw, rejectionReason: "currency_mismatch" },
    });
    return { processed: false, reason: "currency_mismatch" };
  }

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
  const r = repo();
  const attempts = await r.findPaymentAttemptsByOrderId(orderId);
  const result = [];
  for (const a of attempts) {
    const transactions = await r.findTransactionsByAttemptId(a.id);
    result.push({ ...a, transactions });
  }
  return result;
}

export async function getPaymentList() {
  return repo().listPaymentAttempts();
}
