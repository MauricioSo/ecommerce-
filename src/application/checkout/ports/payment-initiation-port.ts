export type PaymentInitiationPort = {
  initiatePayment(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ attemptId: string; status: string }>;
};
