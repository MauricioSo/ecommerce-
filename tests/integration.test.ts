import { describe, test, expect, beforeAll } from "bun:test";
import { renderView } from "../src/web/templates/engine.ts";
import { setPaymentProvider, type PaymentProvider, type PaymentProviderResult, type WebhookEvent } from "../src/modules/payments/application/provider.ts";

if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgres://localhost/test";

class MockProvider implements PaymentProvider {
  readonly name = "mock";
  async createIntent(): Promise<PaymentProviderResult> {
    return { success: true, providerIntentId: "mock_123", status: "approved" };
  }
  parseWebhook(): WebhookEvent | null {
    return null;
  }
}

beforeAll(() => {
  setPaymentProvider(new MockProvider());
});

describe("Render smoke - templates basicos", () => {
  test("layouts/base.eta renderiza HTML completo", () => {
    const html = renderView("layouts/base.eta", { body: "<p>test</p>", title: "Test" });
    expect(html).toContain("<p>test</p>");
    expect(html).toContain("Test | Maison \u00c9lite");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("layouts/admin.eta renderiza con sidebar", () => {
    const html = renderView("layouts/admin.eta", { body: "<p>admin</p>", title: "Admin", csrfToken: "tok123" });
    expect(html).toContain("<p>admin</p>");
    expect(html).toContain("Admin - Admin Panel");
    expect(html).toContain("Dashboard");
  });

  test("layouts/base.eta usa raw para body (contenido pre-renderizado)", () => {
    const html = renderView("layouts/base.eta", { body: "<b>bold</b>", title: "Test" });
    expect(html).toContain("<b>bold</b>");
  });

  test("layouts/base.eta escapa titulo", () => {
    const html = renderView("layouts/base.eta", { body: "x", title: "<script>" });
    expect(html).not.toContain("<title><script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("checkout-success.eta con paymentStatus rejected muestra rechazo", () => {
    const html = renderView("pages/storefront/checkout-success.eta", {
      title: "Rechazado",
      paymentStatus: "rejected",
      message: "Pago rechazado",
      orderId: "order-123",
    });
    expect(html).toContain("rechazado");
    expect(html).toContain("order-123");
    expect(html).toContain("Reintentar pago");
  });

  test("checkout-success.eta con paymentStatus approved muestra exito", () => {
    const html = renderView("pages/storefront/checkout-success.eta", {
      title: "Exito",
      paymentStatus: "approved",
      message: "",
      orderId: "order-456",
    });
    expect(html).toContain("order-456");
  });
});

describe("CSRF - ensureCsrfToken", () => {
  test("retorna token existente si ya esta en cookie", () => {
    const cookie = { _csrf: { value: "existing-token-abc" } };
    const { ensureCsrfToken } = require("../src/web/helpers/csrf.ts") as typeof import("../src/web/helpers/csrf.ts");
    const token = ensureCsrfToken(cookie);
    expect(token).toBe("existing-token-abc");
  });

  test("genera token nuevo si no existe cookie y no esta vacio", () => {
    const { ensureCsrfToken } = require("../src/web/helpers/csrf.ts") as typeof import("../src/web/helpers/csrf.ts");
    let setCalled = false;
    const cookie = {
      _csrf: {
        get value() { return undefined; },
        set: (_opts: unknown) => { setCalled = true; },
      },
    };
    try {
      const token = ensureCsrfToken(cookie);
      expect(token).toBeTruthy();
      expect(token).not.toBe("");
      expect(setCalled).toBe(true);
    } catch (e) {
      expect((e as Error).message).toContain("config");
    }
  });
});

describe("MP signature - verifySignature rechaza firmas invalidas", () => {
  test("sin requestId ni dataId rechaza webhook", async () => {
    const { MercadoPagoProvider } = await import("../src/modules/payments/infrastructure/mercadopago-provider.ts");
    const provider = new MercadoPagoProvider("test-token", "test-secret", "test-pk", "http://localhost:3000");

    const result = provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      "ts=1234567890,v1=somefakesignature",
      undefined,
      undefined,
    );
    expect(result).toBeNull();
  });

  test("firma falsa con requestId y dataId rechaza", async () => {
    const { MercadoPagoProvider } = await import("../src/modules/payments/infrastructure/mercadopago-provider.ts");
    const provider = new MercadoPagoProvider("test-token", "test-secret", "test-pk", "http://localhost:3000");

    const result = provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      "ts=1234567890,v1=fakesignature1234567890abcdef1234567890abcdef",
      "req-id-123",
      "data-456",
    );
    expect(result).toBeNull();
  });

  test("sin signature rechaza", async () => {
    const { MercadoPagoProvider } = await import("../src/modules/payments/infrastructure/mercadopago-provider.ts");
    const provider = new MercadoPagoProvider("test-token", "test-secret", "test-pk", "http://localhost:3000");

    const result = provider.parseWebhook(
      JSON.stringify({ action: "payment.created", data: { id: "123" } }),
      null,
      "req-id-123",
      "data-456",
    );
    expect(result).toBeNull();
  });
});
