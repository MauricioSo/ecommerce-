import type { FinalizePaymentInput, PaymentFinalizer, RecordPaymentEventInput } from "./ports/payment-finalizer.ts";

let finalizer: PaymentFinalizer | null = null;

export function setPaymentFinalizer(f: PaymentFinalizer): void {
  finalizer = f;
}

function resolveFinalizer(): PaymentFinalizer {
  if (!finalizer) throw new Error("PaymentFinalizer dependency was not configured");
  return finalizer;
}

export async function finalizePaymentAttemptFromProvider(input: FinalizePaymentInput): Promise<{ success: boolean; reason?: string }> {
  return resolveFinalizer().finalizePaymentAttemptFromProvider(input);
}

export async function recordPaymentEvent(input: RecordPaymentEventInput): Promise<void> {
  await resolveFinalizer().recordPaymentEvent(input);
}
