import type { PaymentProvider, PaymentProviderResult, WebhookEvent } from "../application/provider.ts";

type MpPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

type MpWebhookPayload = {
  action?: string;
  type?: string;
  data?: { id?: string };
  api_version?: string;
  live_mode?: boolean;
};

type MpPaymentResponse = {
  id: number;
  status: string;
  order_id: string;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  metadata?: Record<string, unknown>;
};

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";
  private accessToken: string;
  private webhookSecret: string;
  private baseUrl: string;

  constructor(accessToken: string, webhookSecret: string, _publicKey: string, private siteBaseUrl: string) {
    this.accessToken = accessToken;
    this.webhookSecret = webhookSecret;
    this.baseUrl = "https://api.mercadopago.com";
  }

  async createIntent(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentProviderResult> {
    const preference = {
      items: [{
        id: input.orderId,
        title: `Order ${input.orderId.slice(0, 8)}`,
        quantity: 1,
        unit_price: input.amountCents / 100,
        currency_id: this.mapCurrency(input.currency),
      }],
      external_reference: input.orderId,
      metadata: {
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
        attemptId: (input.metadata as Record<string, unknown>)?.attemptId ?? "",
      },
      back_urls: {
        success: `${this.siteBaseUrl}/checkout/return/mercadopago?status=success&order_id=${input.orderId}`,
        failure: `${this.siteBaseUrl}/checkout/return/mercadopago?status=failure&order_id=${input.orderId}`,
        pending: `${this.siteBaseUrl}/checkout/return/mercadopago?status=pending&order_id=${input.orderId}`,
      },
      auto_return: "approved" as const,
      notification_url: `${this.siteBaseUrl}/webhooks/payments`,
    };

    const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        providerIntentId: "",
        status: "failed",
        metadata: { error: errorBody, statusCode: response.status },
      };
    }

    const data = (await response.json()) as MpPreferenceResponse;
    return {
      success: true,
      providerIntentId: String(data.id),
      status: "pending",
      metadata: {
        initPoint: data.init_point || data.sandbox_init_point,
        preferenceId: data.id,
      },
    };
  }

  async fetchPaymentStatus(paymentId: string): Promise<{ status: string; metadata: Record<string, unknown> } | null> {
    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${this.accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as MpPaymentResponse;
    return { status: this.mapStatus(data.status), metadata: data as unknown as Record<string, unknown> };
  }

  async parseWebhook(body: string, signature: string | null, requestId?: string, dataId?: string): Promise<WebhookEvent | null> {
    if (this.webhookSecret) {
      if (!signature) return null;
      if (!(await this.verifySignature(body, signature, requestId, dataId))) return null;
    }

    try {
      const data = JSON.parse(body) as MpWebhookPayload;
      const action = data.action ?? data.type ?? "";

      if (action === "payment.created" || action === "payment.updated") {
        const paymentId = data.data?.id;
        if (!paymentId) return null;
        return {
          eventType: action,
          providerEventId: `mp_${paymentId}_${action}`,
          orderId: "",
          attemptId: "",
          status: "pending",
          amountCents: 0,
          currency: "",
          metadata: { paymentId: String(paymentId), requiresFetch: true },
          raw: data as unknown as Record<string, unknown>,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private mapStatus(mpStatus: string): string {
    const map: Record<string, string> = {
      approved: "approved",
      rejected: "rejected",
      cancelled: "cancelled",
      in_process: "processing",
      pending: "pending",
      refunded: "approved",
      charged_back: "rejected",
    };
    return map[mpStatus] ?? "pending";
  }

  private mapCurrency(currency: string): string {
    const map: Record<string, string> = {
      CLP: "CLP", ARS: "ARS", BRL: "BRL", MXN: "MXN",
      COP: "COP", PEN: "PEN", UYU: "UYU", USD: "USD",
    };
    return map[currency] ?? "USD";
  }

  private async verifySignature(_body: string, signature: string, requestId?: string, dataId?: string): Promise<boolean> {
    try {
      if (!this.webhookSecret) return false;
      if (!requestId || !dataId) return false;

      const parts = signature.split(",");
      let ts = "";
      let v1 = "";
      for (const part of parts) {
        const eqIdx = part.indexOf("=");
        if (eqIdx === -1) continue;
        const key = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1).trim();
        if (key === "ts") ts = val;
        if (key === "v1") v1 = val;
      }
      if (!ts || !v1) return false;

      const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
      const keyBytes = new TextEncoder().encode(this.webhookSecret);
      const msgBytes = new TextEncoder().encode(manifest);
      const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
      const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

      if (v1.length !== expected.length) return false;
      const a = new TextEncoder().encode(v1);
      const b = new TextEncoder().encode(expected);
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
      return diff === 0;
    } catch {
      return false;
    }
  }
}
