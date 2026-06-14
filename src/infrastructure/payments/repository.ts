import { eq, desc } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import type { PaymentRepository } from "../../application/payments/ports/payment-repository.ts";

type Db = ReturnType<typeof getDb>;

export function asDb(tx: unknown): Db {
  return tx as Db;
}

export async function findPaymentAttemptById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.id, id));
  return rows[0] ?? null;
}

export async function findPaymentAttemptsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.orderId, orderId)).orderBy(desc(s.paymentAttempts.createdAt));
}

export async function findLatestActivePaymentAttemptByOrderId(orderId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.paymentAttempts)
    .where(eq(s.paymentAttempts.orderId, orderId))
    .orderBy(desc(s.paymentAttempts.createdAt));
  return rows.find((row) => row.status === "pending" || row.status === "processing") ?? null;
}

export async function findPaymentAttemptByIdempotencyKey(key: string, db: Db = getDb()) {
  const rows = await db.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.idempotencyKey, key));
  return rows[0] ?? null;
}

export async function findPaymentAttemptByProviderIntentId(providerIntentId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.providerIntentId, providerIntentId));
  return rows[0] ?? null;
}

export async function insertPaymentAttempt(input: {
  id: string;
  orderId: string;
  provider: string;
  providerIntentId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
}, db: Db = getDb()) {
  await db.insert(s.paymentAttempts).values(input);
}

export async function updatePaymentAttempt(id: string, data: {
  status?: string;
  providerIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
}, db: Db = getDb()) {
  await db.update(s.paymentAttempts).set({ ...data, updatedAt: new Date() }).where(eq(s.paymentAttempts.id, id));
}

export async function insertPaymentTransaction(input: {
  id: string;
  attemptId: string;
  eventType: string;
  providerEventId: string | null;
  payload: Record<string, unknown> | null;
  processedAt: Date | null;
}, db: Db = getDb()) {
  await db.insert(s.paymentTransactions).values(input);
}

export async function findTransactionsByAttemptId(attemptId: string, db: Db = getDb()) {
  return db.select().from(s.paymentTransactions).where(eq(s.paymentTransactions.attemptId, attemptId)).orderBy(desc(s.paymentTransactions.createdAt));
}

export async function findTransactionByProviderEventId(providerEventId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.paymentTransactions).where(eq(s.paymentTransactions.providerEventId, providerEventId));
  return rows[0] ?? null;
}

export async function insertRefund(input: {
  id: string;
  orderId: string;
  paymentAttemptId: string;
  amountCents: number;
  reason: string | null;
  status: string;
}, db: Db = getDb()) {
  await db.insert(s.refunds).values(input);
}

export async function findRefundsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select().from(s.refunds).where(eq(s.refunds.orderId, orderId)).orderBy(desc(s.refunds.createdAt));
}

export async function updateOrderStatus(orderId: string, status: string, db: Db = getDb()) {
  await db.update(s.orders).set({ status, updatedAt: new Date() }).where(eq(s.orders.id, orderId));
}

export async function findOrderById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.orders).where(eq(s.orders.id, id));
  return rows[0] ?? null;
}

export async function findOrdersWithFilters(_filters: { status?: string }, db: Db = getDb()) {
  const query = db.select().from(s.orders).orderBy(desc(s.orders.createdAt));
  return query;
}

export async function findOrderItemsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
}

export async function listPaymentAttempts(db: Db = getDb()) {
  return db.select().from(s.paymentAttempts).orderBy(desc(s.paymentAttempts.createdAt));
}

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: Db = getDb()) {}

  findLatestActivePaymentAttemptByOrderId(orderId: string) { return findLatestActivePaymentAttemptByOrderId(orderId, this.db); }
  findPaymentAttemptByIdempotencyKey(key: string) { return findPaymentAttemptByIdempotencyKey(key, this.db); }
  findPaymentAttemptById(id: string) { return findPaymentAttemptById(id, this.db); }
  findPaymentAttemptsByOrderId(orderId: string) { return findPaymentAttemptsByOrderId(orderId, this.db); }
  findTransactionsByAttemptId(attemptId: string) { return findTransactionsByAttemptId(attemptId, this.db); }
  listPaymentAttempts() { return listPaymentAttempts(this.db); }
}
