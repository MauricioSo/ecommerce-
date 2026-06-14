export type FinalizePaymentInput = {
  attemptId: string;
  newStatus: string;
  eventType: string;
  providerEventId: string;
  payload: Record<string, unknown>;
};

export type RecordPaymentEventInput = {
  attemptId: string;
  eventType: string;
  providerEventId: string;
  payload: Record<string, unknown>;
};

export interface PaymentFinalizer {
  finalizePaymentAttemptFromProvider(input: FinalizePaymentInput): Promise<{ success: boolean; reason?: string }>;
  recordPaymentEvent(input: RecordPaymentEventInput): Promise<void>;
}
