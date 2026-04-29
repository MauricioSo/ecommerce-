import { describe, test, expect } from "bun:test";
import { MockPaymentProvider } from "../src/modules/payments/application/provider.ts";

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

  test("parseWebhook parsea JSON valido", () => {
    const event = provider.parseWebhook(
      JSON.stringify({ eventType: "charge_succeeded", orderId: "o1", attemptId: "a1", status: "approved", amountCents: 1000, currency: "CLP" }),
      null
    );
    expect(event).not.toBeNull();
    expect(event!.eventType).toBe("charge_succeeded");
    expect(event!.status).toBe("approved");
  });

  test("parseWebhook retorna null para JSON invalido", () => {
    expect(provider.parseWebhook("not json", null)).toBeNull();
  });

  test("parseWebhook genera UUID si no hay providerEventId", () => {
    const event = provider.parseWebhook(
      JSON.stringify({ orderId: "o1", attemptId: "a1" }),
      null
    );
    expect(event).not.toBeNull();
    expect(event!.providerEventId).toBeDefined();
    expect(event!.providerEventId.length).toBeGreaterThan(0);
  });
});
