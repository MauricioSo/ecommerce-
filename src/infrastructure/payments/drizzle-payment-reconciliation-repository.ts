import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import type { OrphanedPayment, PaymentReconciliationRepository, StalePayment } from "../../application/payments/ports/payment-reconciliation-repository.ts";

type Db = ReturnType<typeof getDb>;

export class DrizzlePaymentReconciliationRepository implements PaymentReconciliationRepository {
  constructor(private readonly db: Db = getDb()) {}

  async findStalePendingPayments(maxAgeMinutes: number): Promise<StalePayment[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const rows = await this.db.select({
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

  async findApprovedPaymentsWithoutConfirmedOrder(): Promise<OrphanedPayment[]> {
    return this.db.select({
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
  }

  async markOrderConfirmedFromReconciliation(orderId: string, paymentAttemptId: string): Promise<void> {
    await this.db.update(s.orders).set({ status: "confirmed", updatedAt: new Date() }).where(eq(s.orders.id, orderId));
    await this.db.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "order",
      aggregateId: orderId,
      eventType: "reconciled_payment_approved",
      payload: { paymentAttemptId, reason: "reconciliation_job" },
      actorId: null,
      correlationId: null,
    });
  }

  async markPaymentAttemptFailedFromReconciliation(paymentAttemptId: string, orderId: string, ageMinutes: number): Promise<void> {
    await this.db.update(s.paymentAttempts).set({ status: "failed", updatedAt: new Date() }).where(eq(s.paymentAttempts.id, paymentAttemptId));
    await this.db.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "payment",
      aggregateId: paymentAttemptId,
      eventType: "payment_auto_failed_stale",
      payload: { orderId, ageMinutes, reason: "reconciliation_stale_timeout" },
      actorId: null,
      correlationId: null,
    });
  }
}
