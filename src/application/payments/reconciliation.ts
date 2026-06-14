import { DrizzlePaymentReconciliationRepository } from "../../infrastructure/payments/drizzle-payment-reconciliation-repository.ts";
import type { OrphanedPayment, StalePayment } from "./ports/payment-reconciliation-repository.ts";

const reconciliationRepository = new DrizzlePaymentReconciliationRepository();

export async function findStalePendingPayments(maxAgeMinutes: number = 30): Promise<StalePayment[]> {
  return reconciliationRepository.findStalePendingPayments(maxAgeMinutes);
}

export async function findApprovedPaymentsWithoutConfirmedOrder(): Promise<OrphanedPayment[]> {
  return reconciliationRepository.findApprovedPaymentsWithoutConfirmedOrder();
}

export async function reconcileOrphanedPayments(): Promise<{ fixed: number; errors: number }> {
  const orphans = await findApprovedPaymentsWithoutConfirmedOrder();
  let fixed = 0;
  let errors = 0;
  for (const o of orphans) {
    try {
      await reconciliationRepository.markOrderConfirmedFromReconciliation(o.orderId, o.id);
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
  for (const p of stale) {
    try {
      await reconciliationRepository.markPaymentAttemptFailedFromReconciliation(p.id, p.orderId, p.ageMinutes);
      failed++;
    } catch {
      errors++;
    }
  }
  return { failed, errors };
}
