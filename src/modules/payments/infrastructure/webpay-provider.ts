import type { PaymentProvider, PaymentProviderResult, WebhookEvent } from "../application/provider.ts";

type TbkCreateResponse = {
  token: string;
  url: string;
};

type TbkCommitResponse = {
  status: string;
  buy_order: string;
  session_id: string;
  amount: number;
  card_detail: { card_number: string } | null;
  accounting_date: string;
  transaction_date: string;
  authorization_code: string | null;
  payment_type_code: string;
  response_code: number;
  installments_number: number;
};

export class WebPayProvider implements PaymentProvider {
  readonly name = "webpay";
  private commerceCode: string;
  private apiKey: string;
  private apiUrl: string;
  private siteBaseUrl: string;

  constructor(commerceCode: string, apiKey: string, environment: string, siteBaseUrl: string) {
    this.commerceCode = commerceCode;
    this.apiKey = apiKey;
    this.siteBaseUrl = siteBaseUrl;
    this.apiUrl = environment === "production"
      ? "https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.0"
      : "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.0";
  }

  async createIntent(input: {
    orderId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentProviderResult> {
    const amount = input.amountCents / 100;
    const buyOrder = input.orderId.slice(0, 26);
    const sessionId = input.idempotencyKey.slice(0, 61);

    const response = await fetch(`${this.apiUrl}/transactions`, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": this.commerceCode,
        "Tbk-Api-Key-Secret": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buy_order: buyOrder,
        session_id: sessionId,
        amount,
        return_url: `${this.siteBaseUrl}/checkout/return/webpay`,
      }),
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

    const data = (await response.json()) as TbkCreateResponse;
    return {
      success: true,
      providerIntentId: data.token,
      status: "pending",
      metadata: {
        url: data.url,
        token: data.token,
      },
    };
  }

  async commitTransaction(token: string): Promise<{ status: string; metadata: Record<string, unknown> } | null> {
    const response = await fetch(`${this.apiUrl}/transactions/${token}`, {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": this.commerceCode,
        "Tbk-Api-Key-Secret": this.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;
    const data = (await response.json()) as TbkCommitResponse;
    return {
      status: data.response_code === 0 && data.status === "AUTHORIZED" ? "approved" : "rejected",
      metadata: data as unknown as Record<string, unknown>,
    };
  }

  async refundTransaction(token: string, amount: number): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/transactions/${token}/refunds`, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": this.commerceCode,
        "Tbk-Api-Key-Secret": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });
    return response.ok;
  }

  async parseWebhook(body: string, signature: string | null): Promise<WebhookEvent | null> {
    if (!(await this.verifyWebhookSignature(body, signature))) return null;
    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      const token = data.token_ws as string | undefined;
      if (!token) return null;
      return {
        eventType: "webpay_commit",
        providerEventId: `webpay_commit_${token}`,
        orderId: "",
        attemptId: "",
        status: "pending",
        amountCents: 0,
        currency: "CLP",
        metadata: { token, requiresCommit: true },
        raw: data,
      };
    } catch {
      return null;
    }
  }

  private async verifyWebhookSignature(body: string, signature: string | null): Promise<boolean> {
    if (!this.apiKey) return false;
    if (!signature) return false;
    try {
      const value = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(this.apiKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (value.length !== expected.length) return false;
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
      return diff === 0;
    } catch {
      return false;
    }
  }
}
