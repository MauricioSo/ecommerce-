export type PaymentProviderResult = {
  success: boolean;
  providerIntentId: string;
  status: "approved" | "rejected" | "failed" | "pending";
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
};

export type WebhookEvent = {
  eventType: string;
  providerEventId: string;
  orderId: string;
  attemptId: string;
  status: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentProviderResult>;
  parseWebhook(body: string, signature: string | null, requestId?: string, dataId?: string): Promise<WebhookEvent | null>;
  fetchExternalStatus?(paymentId: string): Promise<PaymentProviderResult | null>;
  commitReturn?(token: string): Promise<PaymentProviderResult | null>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createIntent(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<PaymentProviderResult> {
    return {
      success: true,
      providerIntentId: `mock_${input.idempotencyKey}`,
      status: "approved",
      redirectUrl: `/checkout/success?mock=true&order=${input.orderId}`,
      metadata: { mock: true },
    };
  }

  async parseWebhook(body: string, _signature: string | null, _requestId?: string, _dataId?: string): Promise<WebhookEvent | null> {
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      return {
        eventType: (data.eventType as string) ?? "charge_succeeded",
        providerEventId: (data.providerEventId as string) ?? crypto.randomUUID(),
        orderId: data.orderId as string,
        attemptId: data.attemptId as string,
        status: (data.status as string) ?? "approved",
        amountCents: (data.amountCents as number) ?? 0,
        currency: (data.currency as string) ?? "USD",
        raw: data,
      };
    } catch {
      return null;
    }
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) {
    throw new Error("PaymentProvider dependency was not configured");
  }
  return provider;
}

export function setPaymentProvider(p: PaymentProvider): void {
  provider = p;
}
