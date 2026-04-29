import { eq, and, lt, sql } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

export type StalePayment = {
  id: string;
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: Date;
  ageMinutes: number;
};

export type OrphanedPayment = {
  id: string;
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
};

export async function findStalePendingPayments(maxAgeMinutes: number = 30): Promise<StalePayment[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const rows = await db.select({
    id: s.paymentAttempts.id,
    orderId: s.paymentAttempts.orderId,
    status: s.paymentAttempts.status,
    amountCents: s.paymentAttempts.amountCents,
    currency: s.paymentAttempts.currency,
    createdAt: s.paymentAttempts.createdAt,
  }).from(s.paymentAttempts)
    .where(and(
      eq(s.paymentAttempts.status, "pending"),
      lt(s.paymentAttempts.createdAt, cutoff),
    ))
    .orderBy(s.paymentAttempts.createdAt);
  return rows.map((r) => ({
    ...r,
    ageMinutes: Math.round((Date.now() - r.createdAt.getTime()) / 60000),
  }));
}

export async function findApprovedPaymentsWithoutConfirmedOrder(): Promise<OrphanedPayment[]> {
  const db = getDb();
  const rows = await db.select({
    id: s.paymentAttempts.id,
    orderId: s.paymentAttempts.orderId,
    status: s.paymentAttempts.status,
    amountCents: s.paymentAttempts.amountCents,
    currency: s.paymentAttempts.currency,
  }).from(s.paymentAttempts)
    .innerJoin(s.orders, eq(s.paymentAttempts.orderId, s.orders.id))
    .where(and(
      eq(s.paymentAttempts.status, "approved"),
      sql`${s.orders.status} != 'confirmed'`,
    ));
  return rows;
}

export async function reconcileOrphanedPayments(): Promise<{ fixed: number; errors: number }> {
  const orphans = await findApprovedPaymentsWithoutConfirmedOrder();
  let fixed = 0;
  let errors = 0;
  const db = getDb();
  for (const o of orphans) {
    try {
      await db.update(s.orders).set({ status: "confirmed", updatedAt: new Date() }).where(eq(s.orders.id, o.orderId));
      await db.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "order",
        aggregateId: o.orderId,
        eventType: "reconciled_payment_approved",
        payload: { paymentAttemptId: o.id, reason: "reconciliation_job" },
        actorId: null,
        correlationId: null,
      });
      fixed++;
    } catch {
      errors++;
    }
  }
  return { fixed, errors };
}

export async function failStalePendingPayments(maxAgeMinutes: number = 60): Promise<{ failed: number; errors: number }> {
  const stale = await findStalePendingPayments(maxAgeMinutes);
  let failed = 0;
  let errors = 0;
  const db = getDb();
  for (const p of stale) {
    try {
      await db.update(s.paymentAttempts).set({ status: "failed", updatedAt: new Date() }).where(eq(s.paymentAttempts.id, p.id));
      await db.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "payment",
        aggregateId: p.id,
        eventType: "payment_auto_failed_stale",
        payload: { orderId: p.orderId, ageMinutes: p.ageMinutes, reason: "reconciliation_stale_timeout" },
        actorId: null,
        correlationId: null,
      });
      failed++;
    } catch {
      errors++;
    }
  }
  return { failed, errors };
}
