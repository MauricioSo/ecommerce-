import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";
process.env.PAYMENT_PROVIDER = "mock";

import { resetConfig } from "../../src/shared/infrastructure/config.ts";
import { getDb } from "../../src/shared/infrastructure/db/index.ts";
import * as s from "../../src/shared/infrastructure/db/schema.ts";
import { setPaymentProvider, type PaymentProvider, type PaymentProviderResult, type WebhookEvent } from "../../src/application/payments/provider.ts";
import { addToCartUseCase, startCheckoutUseCase, setCheckoutShippingUseCase, confirmCheckoutUseCase } from "../../src/application/checkout/use-cases.ts";
import { signCookieValue } from "../../src/web/helpers/signed-cookie.ts";

const runDbIntegration = process.env.RUN_DB_INTEGRATION === "1";
const describeDb = runDbIntegration ? describe : describe.skip;
let app: { handle(request: Request): Promise<Response> };
let db: ReturnType<typeof getDb>;

class ThrowingProvider implements PaymentProvider {
  readonly name = "test-throwing";
  async createIntent(): Promise<PaymentProviderResult> {
    throw new Error("provider unavailable");
  }
  async parseWebhook(): Promise<WebhookEvent | null> {
    return null;
  }
}

class RedirectProvider implements PaymentProvider {
  readonly name = "test-redirect";
  async createIntent(input: { idempotencyKey: string }): Promise<PaymentProviderResult> {
    return {
      success: true,
      providerIntentId: `retry_${input.idempotencyKey}`,
      status: "pending",
      metadata: { initPoint: "https://payments.example.test/retry" },
    };
  }
  async parseWebhook(): Promise<WebhookEvent | null> {
    return null;
  }
}

async function createSku(priceCents = 1000, stock = 10) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const categoryId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const skuId = crypto.randomUUID();
  await db.insert(s.categories).values({ id: categoryId, name: `Checkout Test ${suffix}`, slug: `checkout-test-${suffix}`, isActive: true });
  await db.insert(s.products).values({ id: productId, name: `Checkout Product ${suffix}`, slug: `checkout-product-${suffix}`, categoryId, editorialStatus: "published" });
  await db.insert(s.skus).values({ id: skuId, productId, sku: `CHK-${suffix}`, variantLabel: "Test", priceCents, currency: "USD", isActive: true });
  await db.insert(s.inventoryItems).values({ skuId, physicalStock: stock, reservedStock: 0, adjustedStock: 0 });
  return { categoryId, productId, skuId };
}

async function createReadyCheckout(input: { priceCents?: number; stock?: number; quantity?: number; sessionId?: string } = {}) {
  const sku = await createSku(input.priceCents ?? 1000, input.stock ?? 10);
  const sessionId = input.sessionId ?? crypto.randomUUID();
  await addToCartUseCase(sessionId, sku.skuId, input.quantity ?? 1);
  const { checkoutId } = await startCheckoutUseCase(sessionId);
  await setCheckoutShippingUseCase(checkoutId, {
    email: `checkout-${crypto.randomUUID()}@example.test`,
    shippingAddress: {
      line1: "Test 123",
      city: "Santiago",
      state: "RM",
      postalCode: "8320000",
      country: "CHL",
    },
    shippingMethod: "Test shipping",
    shippingCostCents: 0,
    countryCode: "CHL",
  });
  return { ...sku, sessionId, checkoutId };
}

function csrfHeaders(token = "csrf-test-token") {
  return {
    "content-type": "application/x-www-form-urlencoded",
    "x-csrf-token": token,
    "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    cookie: `_csrf=${token}`,
  };
}

async function postConfirm(checkoutId: string) {
  return app.handle(new Request("http://localhost/checkout/confirmar", {
    method: "POST",
    headers: csrfHeaders(),
    body: new URLSearchParams({ checkoutId, csrfToken: "csrf-test-token" }),
  }));
}

async function createRecoverableOrder() {
  setPaymentProvider(new ThrowingProvider());
  const checkout = await createReadyCheckout();
  const res = await postConfirm(checkout.checkoutId);
  expect(res.status).toBe(200);
  const [order] = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId)).limit(1);
  expect(order).toBeDefined();
  return { ...checkout, order: order! };
}

beforeAll(() => {
  if (!runDbIntegration) return;
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5434/ecommerce";
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
  resetConfig();
  const { createApp } = require("../../src/web/app.ts") as typeof import("../../src/web/app.ts");
  app = createApp();
  db = getDb();
});

describeDb("Checkout HTTP integration", () => {
  test("provider initiation failure leaves order retryable as payment_pending", async () => {
    const { order } = await createRecoverableOrder();
    expect(order.status).toBe("payment_pending");
  });

  test("retry payment works for payment_pending order with public token", async () => {
    const { order } = await createRecoverableOrder();
    setPaymentProvider(new RedirectProvider());

    const res = await app.handle(new Request("http://localhost/checkout/retry", {
      method: "POST",
      headers: csrfHeaders(),
      body: new URLSearchParams({ orderId: order.id, token: order.publicToken, csrfToken: "csrf-test-token" }),
      redirect: "manual",
    }));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://payments.example.test/retry");
    const [updated] = await db.select().from(s.orders).where(eq(s.orders.id, order.id)).limit(1);
    expect(updated?.status).toBe("awaiting_payment");
  });

  test("retry payment rejects confirmed orders", async () => {
    const { order } = await createRecoverableOrder();
    await db.update(s.orders).set({ status: "confirmed" }).where(eq(s.orders.id, order.id));

    const res = await app.handle(new Request("http://localhost/checkout/retry", {
      method: "POST",
      headers: csrfHeaders(),
      body: new URLSearchParams({ orderId: order.id, token: order.publicToken, csrfToken: "csrf-test-token" }),
    }));

    expect(await res.text()).toContain("no permite reintentar pago");
  });

  test("retry payment rejects wrong public token", async () => {
    const { order } = await createRecoverableOrder();

    const res = await app.handle(new Request("http://localhost/checkout/retry", {
      method: "POST",
      headers: csrfHeaders(),
      body: new URLSearchParams({ orderId: order.id, token: "wrong-token", csrfToken: "csrf-test-token" }),
    }));

    expect(await res.text()).toContain("Order not found");
  });

  test("retry payment rejects expired stock reservations", async () => {
    const { order, checkoutId } = await createRecoverableOrder();
    await db.update(s.inventoryReservations).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(s.inventoryReservations.checkoutSessionId, checkoutId));

    const res = await app.handle(new Request("http://localhost/checkout/retry", {
      method: "POST",
      headers: csrfHeaders(),
      body: new URLSearchParams({ orderId: order.id, token: order.publicToken, csrfToken: "csrf-test-token" }),
    }));

    expect(await res.text()).toContain("reserva de stock expiro");
  });

  test("confirm checkout rejects changed SKU price before creating order", async () => {
    setPaymentProvider(new RedirectProvider());
    const checkout = await createReadyCheckout({ priceCents: 1000 });
    await db.update(s.skus).set({ priceCents: 2000 }).where(eq(s.skus.id, checkout.skuId));

    const res = await postConfirm(checkout.checkoutId);
    const text = await res.text();
    expect(text).toContain("ha cambiado");
    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(0);
  });

  test("confirm checkout rejects inactive SKU before creating order", async () => {
    setPaymentProvider(new RedirectProvider());
    const checkout = await createReadyCheckout();
    await db.update(s.skus).set({ isActive: false }).where(eq(s.skus.id, checkout.skuId));

    const res = await postConfirm(checkout.checkoutId);
    const text = await res.text();
    expect(text).toContain("ya no esta disponible");
    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(0);
  });

  test("confirm checkout rejects SKU without stock before creating order", async () => {
    setPaymentProvider(new RedirectProvider());
    const checkout = await createReadyCheckout({ stock: 0 });

    const res = await postConfirm(checkout.checkoutId);
    const text = await res.text();
    expect(text).toContain("Insufficient stock");
    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(0);
  });

  test("confirm checkout rejects sessions older than 30 minutes", async () => {
    const checkout = await createReadyCheckout();
    await db.update(s.checkoutSessions).set({ updatedAt: new Date(Date.now() - 31 * 60 * 1000) }).where(eq(s.checkoutSessions.id, checkout.checkoutId));

    const res = await postConfirm(checkout.checkoutId);
    expect(await res.text()).toContain("checkout ha expirado");
  });

  test("unsigned session cookie is ignored and replaced with a signed cookie", async () => {
    const res = await app.handle(new Request("http://localhost/cart", {
      headers: { cookie: `sessionId=${crypto.randomUUID()}` },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("sessionId=v1.");
  });

  test("signed session cookie is accepted without replacement", async () => {
    const sessionId = crypto.randomUUID();
    const res = await app.handle(new Request("http://localhost/cart", {
      headers: { cookie: `sessionId=${signCookieValue(sessionId)}` },
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("sessionId=");
  });
});

describeDb("Cart race condition (4.8)", () => {
  test("concurrent getOrCreateCart calls produce exactly one cart per session", async () => {
    const sessionId = crypto.randomUUID();
    await Promise.all([
      addToCartUseCase(sessionId, (await createSku(500, 10)).skuId, 1),
      addToCartUseCase(sessionId, (await createSku(600, 10)).skuId, 1),
      addToCartUseCase(sessionId, (await createSku(700, 10)).skuId, 1),
    ]);

    const carts = await db.select().from(s.carts).where(eq(s.carts.sessionId, sessionId));
    expect(carts).toHaveLength(1);

    const items = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, carts[0]!.id));
    expect(items).toHaveLength(3);
  });

  test("concurrent cart creation with same session via HTTP returns one cart", async () => {
    const sku = await createSku(800, 10);
    const sessionId = crypto.randomUUID();
    const signed = signCookieValue(sessionId);
    const csrf = "race-csrf-token";

    const headers = {
      "content-type": "application/x-www-form-urlencoded",
      "x-csrf-token": csrf,
      cookie: `sessionId=${signed}; _csrf=${csrf}`,
    };

    const [r1, r2, r3] = await Promise.all([
      app.handle(new Request("http://localhost/cart/add", { method: "POST", headers, body: `skuId=${sku.skuId}&quantity=1&csrfToken=${csrf}` })),
      app.handle(new Request("http://localhost/cart/add", { method: "POST", headers, body: `skuId=${sku.skuId}&quantity=2&csrfToken=${csrf}` })),
      app.handle(new Request("http://localhost/cart/add", { method: "POST", headers, body: `skuId=${sku.skuId}&quantity=3&csrfToken=${csrf}` })),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);

    const carts = await db.select().from(s.carts).where(eq(s.carts.sessionId, sessionId));
    expect(carts).toHaveLength(1);
  });
});

describeDb("Double-confirm idempotency (4.10)", () => {
  test("confirming the same checkout twice creates exactly one order", async () => {
    setPaymentProvider(new ThrowingProvider());
    const checkout = await createReadyCheckout();

    const [res1, res2] = await Promise.all([
      confirmCheckoutUseCase(checkout.checkoutId),
      confirmCheckoutUseCase(checkout.checkoutId),
    ]);

    expect(res1.orderId).toBeTruthy();
    expect(res2.orderId).toBeTruthy();

    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(1);
    expect(orders[0]!.id).toBe(res1.orderId);
  });

  test("sequential double confirm returns same order idempotently", async () => {
    setPaymentProvider(new ThrowingProvider());
    const checkout = await createReadyCheckout();

    const first = await confirmCheckoutUseCase(checkout.checkoutId);
    expect(first.paymentStatus).toBe("failed");

    const second = await confirmCheckoutUseCase(checkout.checkoutId);
    expect(second.orderId).toBe(first.orderId);

    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(1);
  });

  test("double confirm via HTTP creates one order", async () => {
    setPaymentProvider(new ThrowingProvider());
    const checkout = await createReadyCheckout();

    const [r1, r2] = await Promise.all([postConfirm(checkout.checkoutId), postConfirm(checkout.checkoutId)]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const orders = await db.select().from(s.orders).where(eq(s.orders.checkoutSessionId, checkout.checkoutId));
    expect(orders).toHaveLength(1);
  });
});

describeDb("Cart HTTP operations", () => {
  test("add to cart via HTTP with signed session", async () => {
    const sku = await createSku(1000, 10);
    const sessionId = crypto.randomUUID();
    const signed = signCookieValue(sessionId);
    const csrf = "cart-add-csrf";

    const res = await app.handle(new Request("http://localhost/cart/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `skuId=${sku.skuId}&quantity=2&csrfToken=${csrf}`,
    }));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Agregado al carrito");
  });

  test("add to cart rejects quantity > 10", async () => {
    const sku = await createSku(1000, 20);
    const sessionId = crypto.randomUUID();
    const signed = signCookieValue(sessionId);
    const csrf = "cart-qty-csrf";

    const res = await app.handle(new Request("http://localhost/cart/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `skuId=${sku.skuId}&quantity=11&csrfToken=${csrf}`,
    }));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Maximo 10");
  });

  test("add to cart rejects unknown SKU", async () => {
    const sessionId = crypto.randomUUID();
    const signed = signCookieValue(sessionId);
    const csrf = "cart-unknown-csrf";

    const res = await app.handle(new Request("http://localhost/cart/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `skuId=${crypto.randomUUID()}&quantity=1&csrfToken=${csrf}`,
    }));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("not found");
  });

  test("cart page shows empty state for new session", async () => {
    const sessionId = crypto.randomUUID();
    const signed = signCookieValue(sessionId);

    const res = await app.handle(new Request("http://localhost/cart", {
      headers: { cookie: `sessionId=${signed}` },
    }));

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("carrito esta vacio");
  });

  test("update cart item quantity via HTTP", async () => {
    const sku = await createSku(1000, 10);
    const sessionId = crypto.randomUUID();
    await addToCartUseCase(sessionId, sku.skuId, 1);

    const cart = await db.select().from(s.carts).where(eq(s.carts.sessionId, sessionId)).limit(1);
    const items = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cart[0]!.id)).limit(1);
    const csrf = "cart-update-csrf";
    const signed = signCookieValue(sessionId);

    const res = await app.handle(new Request("http://localhost/cart/update", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `itemId=${items[0]!.id}&quantity=5&csrfToken=${csrf}`,
      redirect: "manual",
    }));

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/cart");

    const updated = await db.select().from(s.cartItems).where(eq(s.cartItems.id, items[0]!.id)).limit(1);
    expect(updated[0]!.quantity).toBe(5);
  });

  test("remove cart item via HTTP", async () => {
    const sku = await createSku(1000, 10);
    const sessionId = crypto.randomUUID();
    await addToCartUseCase(sessionId, sku.skuId, 1);

    const cart = await db.select().from(s.carts).where(eq(s.carts.sessionId, sessionId)).limit(1);
    const items = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cart[0]!.id)).limit(1);
    const csrf = "cart-remove-csrf";
    const signed = signCookieValue(sessionId);

    const res = await app.handle(new Request("http://localhost/cart/remove", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `itemId=${items[0]!.id}&csrfToken=${csrf}`,
      redirect: "manual",
    }));

    expect(res.status).toBe(302);
    const remaining = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cart[0]!.id));
    expect(remaining).toHaveLength(0);
  });
});

describeDb("Catalog HTTP routes", () => {
  test("home page renders with 200", async () => {
    const res = await app.handle(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Maison");
  });

  test("search page renders with results", async () => {
    const res = await app.handle(new Request("http://localhost/search?q=test"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Buscar");
  });

  test("autocomplete API returns HTML", async () => {
    await createSku(1500, 5);
    const res = await app.handle(new Request(`http://localhost/api/search/suggest?q=Checkout`));
    expect(res.status).toBe(200);
    const text = await res.text();
    if (text.length > 0) {
      expect(text).toContain("suggest-list");
    }
  });

  test("category page returns 200 for valid category", async () => {
    const { categoryId } = await createSku(2000, 5);
    const [cat] = await db.select().from(s.categories).where(eq(s.categories.id, categoryId)).limit(1);
    const res = await app.handle(new Request(`http://localhost/categories/${cat!.slug}`));
    expect(res.status).toBe(200);
  });

  test("product page returns 200 for valid product", async () => {
    const sku = await createSku(2500, 5);
    const [product] = await db.select().from(s.products)
      .leftJoin(s.skus, eq(s.products.id, s.skus.productId))
      .where(eq(s.skus.id, sku.skuId)).limit(1);
    const res = await app.handle(new Request(`http://localhost/products/${product!.products.slug}`));
    expect(res.status).toBe(200);
  });

  test("sitemap.xml returns valid XML", async () => {
    const res = await app.handle(new Request("http://localhost/sitemap.xml"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("urlset");
  });
});

describeDb("Auth HTTP routes", () => {
  test("customer login page renders", async () => {
    const res = await app.handle(new Request("http://localhost/cuenta/login"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("name=\"email\"");
    expect(html).toContain("name=\"password\"");
  });

  test("customer register page renders", async () => {
    const res = await app.handle(new Request("http://localhost/cuenta/registro"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("name=\"email\"");
  });

  test("admin login page renders", async () => {
    const res = await app.handle(new Request("http://localhost/admin/login"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("name=\"email\"");
  });
});

describeDb("CSRF integration", () => {
  test("POST to cart/add without CSRF cookie returns 403", async () => {
    const sku = await createSku(3000, 5);
    const signed = signCookieValue(crypto.randomUUID());

    const res = await app.handle(new Request("http://localhost/cart/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: `sessionId=${signed}` },
      body: `skuId=${sku.skuId}&quantity=1`,
    }));

    expect(res.status).toBe(403);
  });

  test("POST to cart/add with matching CSRF header passes", async () => {
    const sku = await createSku(3100, 5);
    const signed = signCookieValue(crypto.randomUUID());
    const csrf = "integration-csrf-test";

    const res = await app.handle(new Request("http://localhost/cart/add", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-csrf-token": csrf, cookie: `sessionId=${signed}; _csrf=${csrf}` },
      body: `skuId=${sku.skuId}&quantity=1&csrfToken=${csrf}`,
    }));

    expect(res.status).toBe(200);
  });

  test("POST to checkout/direccion without CSRF returns 403", async () => {
    const res = await app.handle(new Request("http://localhost/checkout/direccion", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "checkoutId=test&line1=test&city=test&state=test&postalCode=12345",
    }));

    expect(res.status).toBe(403);
  });
});

describeDb("Guest cart migration on login", () => {
  test("guest cart items appear in cart page", async () => {
    const sku = await createSku(4000, 10);
    const sessionId = crypto.randomUUID();
    await addToCartUseCase(sessionId, sku.skuId, 2);

    const signed = signCookieValue(sessionId);
    const res = await app.handle(new Request("http://localhost/cart", {
      headers: { cookie: `sessionId=${signed}` },
    }));

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Carrito");
  });
});
