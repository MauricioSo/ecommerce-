import type { OrphanedPayment, PaymentReconciliationRepository, StalePayment } from "./ports/payment-reconciliation-repository.ts";

let reconciliationRepository: PaymentReconciliationRepository | null = null;

export function setPaymentReconciliationRepository(repository: PaymentReconciliationRepository): void {
  reconciliationRepository = repository;
}

function repo(): PaymentReconciliationRepository {
  if (!reconciliationRepository) throw new Error("PaymentReconciliationRepository dependency was not configured");
  return reconciliationRepository;
}

export async function findStalePendingPayments(maxAgeMinutes: number = 30): Promise<StalePayment[]> {
  return repo().findStalePendingPayments(maxAgeMinutes);
}

export async function findApprovedPaymentsWithoutConfirmedOrder(): Promise<OrphanedPayment[]> {
  return repo().findApprovedPaymentsWithoutConfirmedOrder();
}

export async function reconcileOrphanedPayments(): Promise<{ fixed: number; errors: number }> {
  const orphans = await findApprovedPaymentsWithoutConfirmedOrder();
  let fixed = 0;
  let errors = 0;
  for (const o of orphans) {
    try {
      await repo().markOrderConfirmedFromReconciliation(o.orderId, o.id);
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
      await repo().markPaymentAttemptFailedFromReconciliation(p.id, p.orderId, p.ageMinutes);
      failed++;
    } catch {
      errors++;
    }
  }
  return { failed, errors };
}
