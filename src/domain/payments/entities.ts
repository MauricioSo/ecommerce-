import { Money } from "../../shared/domain/money.ts";
import {
  type PaymentStatus,
  type RefundStatus,
  type PaymentEventType,
  PaymentStatus as PS,
  RefundStatus as RS,
  assertTransition,
} from "./types.ts";

export type PaymentAttempt = {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly providerIntentId: string | null;
  readonly amount: Money;
  readonly status: PaymentStatus;
  readonly idempotencyKey: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly transactions: PaymentTransaction[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type PaymentTransaction = {
  readonly id: string;
  readonly attemptId: string;
  readonly eventType: PaymentEventType;
  readonly providerEventId: string | null;
  readonly payload: Record<string, unknown> | null;
  readonly processedAt: Date | null;
  readonly createdAt: Date;
};

export type Refund = {
  readonly id: string;
  readonly orderId: string;
  readonly paymentAttemptId: string;
  readonly amount: Money;
  readonly reason: string | null;
  readonly status: RefundStatus;
  readonly providerRefundId: string | null;
  readonly createdAt: Date;
};

export function createPaymentAttempt(input: {
  orderId: string;
  provider: string;
  amountCents: number;
  currency?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): PaymentAttempt {
  if (!input.orderId) throw new Error("Payment attempt requires an order");
  if (!input.provider) throw new Error("Payment provider is required");
  if (input.amountCents <= 0) throw new Error("Payment amount must be positive");
  return Object.freeze({
    id: crypto.randomUUID(),
    orderId: input.orderId,
    provider: input.provider,
    providerIntentId: null,
    amount: Money.fromCents(input.amountCents, input.currency ?? "USD"),
    status: PS.PENDING,
    idempotencyKey: input.idempotencyKey ?? null,
    metadata: input.metadata ?? null,
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function addTransaction(
  attempt: PaymentAttempt,
  input: {
    eventType: PaymentEventType;
    providerEventId?: string;
    payload?: Record<string, unknown>;
  }
): PaymentAttempt {
  const tx: PaymentTransaction = Object.freeze({
    id: crypto.randomUUID(),
    attemptId: attempt.id,
    eventType: input.eventType,
    providerEventId: input.providerEventId ?? null,
    payload: input.payload ?? null,
    processedAt: new Date(),
    createdAt: new Date(),
  });
  return Object.freeze({
    ...attempt,
    transactions: [...attempt.transactions, tx],
    updatedAt: new Date(),
  });
}

export function processPayment(attempt: PaymentAttempt): PaymentAttempt {
  assertTransition(attempt.status, PS.PROCESSING);
  return Object.freeze({ ...attempt, status: PS.PROCESSING, updatedAt: new Date() });
}

export function approvePayment(
  attempt: PaymentAttempt,
  input: { providerIntentId: string; providerEventId?: string; payload?: Record<string, unknown> }
): PaymentAttempt {
  assertTransition(attempt.status, PS.APPROVED);
  const updated: PaymentAttempt = Object.freeze({
    ...attempt,
    status: PS.APPROVED as PaymentStatus,
    providerIntentId: input.providerIntentId,
    updatedAt: new Date(),
    transactions: attempt.transactions,
  });
  return addTransaction(updated, {
    eventType: "intent_succeeded" as PaymentEventType,
    providerEventId: input.providerEventId,
    payload: input.payload,
  });
}

export function rejectPayment(
  attempt: PaymentAttempt,
  input: { providerEventId?: string; payload?: Record<string, unknown> }
): PaymentAttempt {
  assertTransition(attempt.status, PS.REJECTED);
  const updated: PaymentAttempt = Object.freeze({
    ...attempt,
    status: PS.REJECTED as PaymentStatus,
    updatedAt: new Date(),
    transactions: attempt.transactions,
  });
  return addTransaction(updated, {
    eventType: "intent_failed" as PaymentEventType,
    providerEventId: input.providerEventId,
    payload: input.payload,
  });
}

export function failPayment(attempt: PaymentAttempt): PaymentAttempt {
  assertTransition(attempt.status, PS.FAILED);
  return Object.freeze({ ...attempt, status: PS.FAILED, updatedAt: new Date() });
}

export function cancelPayment(attempt: PaymentAttempt): PaymentAttempt {
  assertTransition(attempt.status, PS.CANCELLED);
  return Object.freeze({ ...attempt, status: PS.CANCELLED, updatedAt: new Date() });
}

export function isPaymentApproved(attempt: PaymentAttempt): boolean {
  return attempt.status === PS.APPROVED;
}

export function isPaymentTerminal(attempt: PaymentAttempt): boolean {
  return ["approved", "rejected", "cancelled"].includes(attempt.status);
}

export function hasProcessedEvent(
  attempt: PaymentAttempt,
  providerEventId: string
): boolean {
  return attempt.transactions.some((tx) => tx.providerEventId === providerEventId);
}

export function createRefund(input: {
  orderId: string;
  paymentAttemptId: string;
  amountCents: number;
  currency?: string;
  reason?: string;
}): Refund {
  if (!input.orderId) throw new Error("Refund requires an order");
  if (!input.paymentAttemptId) throw new Error("Refund requires a payment attempt");
  if (input.amountCents <= 0) throw new Error("Refund amount must be positive");
  return Object.freeze({
    id: crypto.randomUUID(),
    orderId: input.orderId,
    paymentAttemptId: input.paymentAttemptId,
    amount: Money.fromCents(input.amountCents, input.currency ?? "USD"),
    reason: input.reason ?? null,
    status: RS.PENDING,
    providerRefundId: null,
    createdAt: new Date(),
  });
}

export function processRefund(refund: Refund): Refund {
  if (refund.status !== RS.PENDING && refund.status !== RS.FAILED) {
    throw new Error(`Invalid refund transition: ${refund.status} -> processing`);
  }
  return Object.freeze({ ...refund, status: RS.PROCESSING });
}

export function approveRefund(refund: Refund, providerRefundId: string): Refund {
  if (refund.status !== RS.PROCESSING) {
    throw new Error(`Invalid refund transition: ${refund.status} -> approved`);
  }
  return Object.freeze({ ...refund, status: RS.APPROVED, providerRefundId });
}

export function rejectRefund(refund: Refund): Refund {
  if (refund.status !== RS.PENDING) {
    throw new Error(`Invalid refund transition: ${refund.status} -> rejected`);
  }
  return Object.freeze({ ...refund, status: RS.REJECTED });
}

export function failRefund(refund: Refund): Refund {
  if (refund.status !== RS.PROCESSING) {
    throw new Error(`Invalid refund transition: ${refund.status} -> failed`);
  }
  return Object.freeze({ ...refund, status: RS.FAILED });
}
