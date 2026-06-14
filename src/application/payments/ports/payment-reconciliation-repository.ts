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

export interface PaymentReconciliationRepository {
  findStalePendingPayments(maxAgeMinutes: number): Promise<StalePayment[]>;
  findApprovedPaymentsWithoutConfirmedOrder(): Promise<OrphanedPayment[]>;
  markOrderConfirmedFromReconciliation(orderId: string, paymentAttemptId: string): Promise<void>;
  markPaymentAttemptFailedFromReconciliation(paymentAttemptId: string, orderId: string, ageMinutes: number): Promise<void>;
}
