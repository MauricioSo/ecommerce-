import { DrizzlePaymentFinalizer } from "../../infrastructure/payments/drizzle-payment-finalizer.ts";
import type { FinalizePaymentInput, RecordPaymentEventInput } from "./ports/payment-finalizer.ts";

const finalizer = new DrizzlePaymentFinalizer();

export async function finalizePaymentAttemptFromProvider(input: FinalizePaymentInput): Promise<{ success: boolean; reason?: string }> {
  return finalizer.finalizePaymentAttemptFromProvider(input);
}

export async function recordPaymentEvent(input: RecordPaymentEventInput): Promise<void> {
  await finalizer.recordPaymentEvent(input);
}
