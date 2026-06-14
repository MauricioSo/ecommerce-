import type { PaymentProviderResult } from "../provider.ts";

export interface PaymentWorkflow {
  createIntentAttempt(input: {
    attemptId: string;
    orderId: string;
    providerName: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    result: PaymentProviderResult;
  }): Promise<void>;
}
