import { describe, test, expect } from "bun:test";
import { MockPaymentProvider } from "../src/application/payments/provider.ts";
import { MercadoPagoProvider } from "../src/infrastructure/payments/mercadopago-provider.ts";
import { WebPayProvider } from "../src/infrastructure/payments/webpay-provider.ts";
import { isWebhookIpAllowed } from "../src/presentation/payments/routes.ts";
import { resetConfig } from "../src/shared/infrastructure/config.ts";

describe("MockPaymentProvider", () => {
  const provider = new MockPaymentProvider();

  test("name es mock", () => {
    expect(provider.name).toBe("mock");
  });

  test("createIntent retorna approved para mock", async () => {
    const result = await provider.createIntent({
      orderId: "ord-123",
      amountCents: 50000,
      currency: "CLP",
      idempotencyKey: "key-1",
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe("approved");
    expect(result.providerIntentId).toContain("mock_key-1");
    expect(result.redirectUrl).toContain("/checkout/success");
  });

  test("parseWebhook parsea JSON valido", async () => {
    const event = await provider.parseWebhook(
      JSON.stringify({ eventType: "charge_succeeded", orderId: "o1", attemptId: "a1", status: "approved", amountCents: 1000, currency: "CLP" }),
      null
    );
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("charge_succeeded");
    expect(event!.status).toBe("approved");
  });

  test("parseWebhook retorna null para JSON invalido", async () => {
    expect(await provider.parseWebhook("not json", null)).toBeNull();
  });

  test("parseWebhook genera UUID si no hay providerEventId", async () => {
    const event = await provider.parseWebhook(
      JSON.stringify({ orderId: "o1", attemptId: "a1" }),
      null
    );
    expect(event).not.toBeNull();
    expect(event!.providerEventId).toBeDefined();
    expect(event!.providerEventId.length).toBeGreaterThan(0);
  });
});

async function computeSignature(secret: string, dataId: string, requestId: string, ts: string): Promise<string> {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const keyBytes = new TextEncoder().encode(secret);
  const msgBytes = new TextEncoder().encode(manifest);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeBodySignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("MP signature validation", () => {
  const secret = "test-webhook-secret-32chars-minimum!";
  const provider = new MercadoPagoProvider("test-token", secret, "test-pk", "http://localhost:3000");

  test("firma valida con datos correctos pasa", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const ts = "1234567890";
    const v1 = await computeSignature(secret, dataId, requestId, ts);
    const signature = `ts=${ts},v1=${v1}`;

    const event = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: dataId } }),
      signature,
      requestId,
      dataId,
    );
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("payment.created");
  });

  test("providerEventId MP es deterministico para permitir dedupe", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const ts = "1234567890";
    const v1 = await computeSignature(secret, dataId, requestId, ts);
    const signature = `ts=${ts},v1=${v1}`;
    const body = JSON.stringify({ action: "payment.created", data: { id: dataId } });

    const first = await provider.parseWebhook(body, signature, requestId, dataId);
    const second = await provider.parseWebhook(body, signature, requestId, dataId);

    expect(first?.providerEventId).toBe("mp_123456_payment.created");
    expect(second?.providerEventId).toBe(first?.providerEventId);
  });

  test("firma con secret incorrecto rechazada", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const ts = "1234567890";
    const v1 = await computeSignature("wrong-secret-32chars-minimum!!!", dataId, requestId, ts);
    const signature = `ts=${ts},v1=${v1}`;

    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: dataId } }),
      signature,
      requestId,
      dataId,
    );
    expect(result).toBeNull();
  });

  test("firma con dataId incorrecto rechazada", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const ts = "1234567890";
    const v1 = await computeSignature(secret, "wrong-id", requestId, ts);
    const signature = `ts=${ts},v1=${v1}`;

    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: dataId } }),
      signature,
      requestId,
      dataId,
    );
    expect(result).toBeNull();
  });

  test("firma con requestId incorrecto rechazada", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const ts = "1234567890";
    const v1 = await computeSignature(secret, dataId, "wrong-req", ts);
    const signature = `ts=${ts},v1=${v1}`;

    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: dataId } }),
      signature,
      requestId,
      dataId,
    );
    expect(result).toBeNull();
  });

  test("longitudes de hash diferentes rechazada", async () => {
    const dataId = "123456";
    const requestId = "req-789";
    const signature = `ts=1234567890,v1=short`;

    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: dataId } }),
      signature,
      requestId,
      dataId,
    );
    expect(result).toBeNull();
  });

  test("sin signature rechazada", async () => {
    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      null,
      "req-123",
      "456",
    );
    expect(result).toBeNull();
  });

  test("formato de signature incorrecto rechazada", async () => {
    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      "invalid-format",
      "req-123",
      "456",
    );
    expect(result).toBeNull();
  });

  test("sin requestId ni dataId rechazada", async () => {
    const result = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      "ts=123,v1=abc",
      undefined,
      undefined,
    );
    expect(result).toBeNull();
  });
});

describe("MP without secret accepts all webhooks", () => {
  const provider = new MercadoPagoProvider("test-token", "", "test-pk", "http://localhost:3000");

  test("sin secret acepta webhook sin firma", async () => {
    const event = await provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      null,
    );
    expect(event).not.toBeNull();
  });
});

describe("WebPay webhook parsing", () => {
  const apiKey = "webpay-webhook-secret-32chars-minimum";
  const provider = new WebPayProvider("code", apiKey, "integration", "http://localhost:3000");

  test("webhook event id is deterministic by token", async () => {
    const body = JSON.stringify({ token_ws: "token-123", order_id: "user-controlled" });
    const signature = `sha256=${await computeBodySignature(apiKey, body)}`;
    const event = await provider.parseWebhook(body, signature);
    expect(event).not.toBeNull();
    expect(event!.providerEventId).toBe("webpay_commit_token-123");
    expect(event!.orderId).toBe("");
    expect(event!.metadata?.requiresCommit).toBe(true);
  });

  test("webhook without token is rejected", async () => {
    const body = JSON.stringify({ order_id: "o1" });
    const signature = await computeBodySignature(apiKey, body);
    expect(await provider.parseWebhook(body, signature)).toBeNull();
  });

  test("webhook with invalid signature is rejected", async () => {
    const body = JSON.stringify({ token_ws: "token-123" });
    expect(await provider.parseWebhook(body, "sha256=invalid")).toBeNull();
  });
});

describe("Payment webhook IP allowlist", () => {
  test("production rejects IPs outside allowlist", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousAllowlist = process.env.PAYMENT_WEBHOOK_IP_ALLOWLIST;
    const previousSecret = process.env.JWT_SECRET;
    const previousBaseUrl = process.env.BASE_URL;
    const previousDb = process.env.DATABASE_URL;

    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
    process.env.BASE_URL = "https://example.com";
    process.env.DATABASE_URL = "postgres://example:example@db:5432/ecommerce";
    process.env.PAYMENT_WEBHOOK_IP_ALLOWLIST = "203.0.113.10";
    resetConfig();

    expect(isWebhookIpAllowed(new Request("http://localhost/webhooks/payments", { headers: { "x-forwarded-for": "203.0.113.10" } }))).toBe(true);
    expect(isWebhookIpAllowed(new Request("http://localhost/webhooks/payments", { headers: { "x-forwarded-for": "203.0.113.11" } }))).toBe(false);

    process.env.NODE_ENV = previousEnv;
    process.env.PAYMENT_WEBHOOK_IP_ALLOWLIST = previousAllowlist;
    process.env.JWT_SECRET = previousSecret;
    process.env.BASE_URL = previousBaseUrl;
    process.env.DATABASE_URL = previousDb;
    resetConfig();
  });
});
