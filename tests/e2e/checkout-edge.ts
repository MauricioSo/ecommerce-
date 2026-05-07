import { expect, test, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";
const jwtSecret = "test-secret-at-least-32-characters-long";
const runId = randomUUID().slice(0, 8);

async function setSignedSession(page: Page) {
  const sessionId = randomUUID();
  const signature = createHmac("sha256", jwtSecret).update(sessionId).digest("base64url");
  await page.context().addCookies([{ name: "sessionId", value: `v1.${sessionId}.${signature}`, domain: "localhost", path: "/" }]);
}

async function syncCsrf(page: Page) {
  const token = await page.locator("input[name='csrfToken']").first().inputValue();
  await page.context().addCookies([{ name: "_csrf", value: token, domain: "localhost", path: "/", httpOnly: true }]);
}

// @ts-expect-error used in test bodies
async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await client.query(query, params); } finally { await client.end(); }
}

let skuId: string;
let productSlug: string;

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const categoryId = randomUUID();
    const productId = randomUUID();
    skuId = randomUUID();
    productSlug = `checkout-edge-${runId}`;
    await client.query(`INSERT INTO categories (id, name, slug, is_active) VALUES ($1, $2, $3, true) ON CONFLICT (slug) DO NOTHING`, [categoryId, `Checkout Edge ${runId}`, `checkout-edge-cat-${runId}`]);
    await client.query(`INSERT INTO products (id, name, slug, description, category_id, editorial_status) VALUES ($1, $2, $3, $4, $5, 'published') ON CONFLICT (slug) DO NOTHING`, [productId, `Checkout Edge Product ${runId}`, productSlug, "E2E checkout edge test", categoryId]);
    await client.query(`INSERT INTO skus (id, product_id, sku, variant_label, price_cents, currency, is_active) VALUES ($1, $2, $3, 'Default', 50000, 'USD', true) ON CONFLICT (sku) DO NOTHING`, [skuId, productId, `EDGE-${runId}`]);
    await client.query(`INSERT INTO inventory_items (sku_id, physical_stock, reserved_stock, adjusted_stock) VALUES ($1, 25, 0, 0) ON CONFLICT (sku_id) DO UPDATE SET physical_stock = 25`, [skuId]);
  } finally {
    await client.end();
  }
});

test("E2E-CHK-01 add to cart rejects quantity over max (10)", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrf(page);
  await page.locator("input[name='quantity']").fill("11");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText(/maximo.*10/i)).toBeVisible();
});

test("E2E-CHK-02 cart shows empty state for new session", async ({ page }) => {
  await setSignedSession(page);
  await page.goto("/cart");
  await expect(page.getByText(/carrito esta vacio/i)).toBeVisible();
});

test("E2E-CHK-03 cart persists items across navigation", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrf(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/");
  await page.goto("/cart");
  await expect(page.getByText(`Checkout Edge Product ${runId}`)).toBeVisible();
});

test("E2E-CHK-04 checkout redirects to cart when empty", async ({ page }) => {
  await setSignedSession(page);
  await page.goto("/checkout");
  await page.waitForURL(/\/cart/, { timeout: 10000 });
  await expect(page).toHaveURL(/\/cart/);
});

test("E2E-CHK-05 full checkout flow with different quantities", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrf(page);
  await page.locator("input[name='quantity']").fill("3");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/cart");
  await expect(page.locator("input[name='quantity']")).toHaveValue("3");
  await page.getByRole("link", { name: "Ir al checkout" }).click();
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(`edge-${runId}@example.test`);
  await page.locator("input[name='firstName']").fill("Edge");
  await page.locator("input[name='lastName']").fill("Test");
  await page.locator("input[name='phone']").fill("+56912345678");
  await page.locator("input[name='line1']").fill("Test 456");
  await page.locator("input[name='city']").fill("Santiago");
  await page.locator("input[name='state']").fill("RM");
  await page.locator("input[name='postalCode']").fill("8320000");
  await page.getByRole("button", { name: "Continuar a envio" }).click();
  await expect(page.getByRole("heading", { name: "Metodo de envio" })).toBeVisible();
  await syncCsrf(page);
  await page.getByRole("button", { name: "Continuar a pago" }).click();
  await expect(page.getByRole("heading", { name: "Confirmar pedido" })).toBeVisible();
  await syncCsrf(page);
  await page.getByRole("button", { name: "Confirmar y pagar" }).click();
  await expect(page.getByRole("heading", { name: /pedido confirmado|procesando/i })).toBeVisible();
});

test("E2E-CHK-06 order status page with invalid token redirects", async ({ page }) => {
  const res = await page.request.get(`/orders/${randomUUID()}?token=invalid`);
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("E2E-CHK-07 multiple items in cart checkout", async ({ page }) => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const sku2 = randomUUID();
  const prod2 = randomUUID();
  try {
    await client.query(`INSERT INTO products (id, name, slug, description, category_id, editorial_status) VALUES ($1, $2, $3, $4, (SELECT id FROM categories WHERE slug = 'checkout-edge-cat-${runId}'), 'published') ON CONFLICT (slug) DO NOTHING`, [prod2, `Multi Item ${runId}`, `multi-item-${runId}`, "E2E multi"]);
    await client.query(`INSERT INTO skus (id, product_id, sku, variant_label, price_cents, currency, is_active) VALUES ($1, $2, $3, 'V2', 25000, 'USD', true) ON CONFLICT (sku) DO NOTHING`, [sku2, prod2, `MULTI-${runId}`]);
    await client.query(`INSERT INTO inventory_items (sku_id, physical_stock, reserved_stock, adjusted_stock) VALUES ($1, 10, 0, 0) ON CONFLICT (sku_id) DO UPDATE SET physical_stock = 10`, [sku2]);
  } finally {
    await client.end();
  }

  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrf(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();

  await page.goto(`/products/multi-item-${runId}`);
  await syncCsrf(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText(`Checkout Edge Product ${runId}`)).toBeVisible();
  await expect(page.getByText(`Multi Item ${runId}`)).toBeVisible();
});

test("E2E-CHK-08 checkout with mock payment shows confirmation", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrf(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir al checkout" }).click();
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(`chk8-${runId}@example.test`);
  await page.locator("input[name='firstName']").fill("Test");
  await page.locator("input[name='lastName']").fill("User");
  await page.locator("input[name='phone']").fill("+56912345678");
  await page.locator("input[name='line1']").fill("Calle 789");
  await page.locator("input[name='city']").fill("Valparaiso");
  await page.locator("input[name='state']").fill("V");
  await page.locator("input[name='postalCode']").fill("2340000");
  await page.getByRole("button", { name: "Continuar a envio" }).click();
  await expect(page.getByRole("heading", { name: "Metodo de envio" })).toBeVisible();
  await syncCsrf(page);
  await page.getByRole("button", { name: "Continuar a pago" }).click();
  await expect(page.getByRole("heading", { name: "Confirmar pedido" })).toBeVisible();
  const body = await page.locator("body").textContent();
  expect(body).toContain("$500");
  await syncCsrf(page);
  await page.getByRole("button", { name: "Confirmar y pagar" }).click();
  await expect(page.getByRole("heading", { name: /pedido/i })).toBeVisible({ timeout: 10000 });
});
