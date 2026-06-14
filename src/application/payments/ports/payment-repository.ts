export type PaymentAttemptRow = {
  id: string;
  orderId: string;
  provider: string;
  providerIntentId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  idempotencyKey: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentTransactionRow = {
  id: string;
  attemptId: string;
  eventType: string;
  providerEventId: string | null;
  payload: unknown;
  processedAt: Date | null;
  createdAt: Date;
};

export interface PaymentRepository {
  findLatestActivePaymentAttemptByOrderId(orderId: string): Promise<PaymentAttemptRow | null>;
  findPaymentAttemptByIdempotencyKey(key: string): Promise<PaymentAttemptRow | null>;
  findPaymentAttemptById(id: string): Promise<PaymentAttemptRow | null>;
  findPaymentAttemptsByOrderId(orderId: string): Promise<PaymentAttemptRow[]>;
  findTransactionsByAttemptId(attemptId: string): Promise<PaymentTransactionRow[]>;
  listPaymentAttempts(): Promise<PaymentAttemptRow[]>;
}
