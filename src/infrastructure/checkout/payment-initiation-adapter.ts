import { initiatePaymentUseCase } from "../../application/payments/use-cases.ts";
import type { PaymentInitiationPort } from "../../application/checkout/ports/payment-initiation-port.ts";

export class PaymentInitiationAdapter implements PaymentInitiationPort {
  async initiatePayment(input: { orderId: string; amountCents: number; currency: string; idempotencyKey: string }) {
    return initiatePaymentUseCase(input);
  }
}
