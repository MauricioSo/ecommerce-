import { expect, test, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";
const runId = randomUUID().slice(0, 8);
const categorySlug = `e2e-category-${runId}`;
const productSlug = `e2e-product-${runId}`;
const productName = `E2E Product ${runId}`;
const jwtSecret = "test-secret-at-least-32-characters-long";

async function setSignedSession(page: Page) {
  const sessionId = randomUUID();
  const signature = createHmac("sha256", jwtSecret).update(sessionId).digest("base64url");
  await page.context().addCookies([{ name: "sessionId", value: `v1.${sessionId}.${signature}`, domain: "localhost", path: "/" }]);
}

async function syncCsrfCookie(page: Page) {
  const token = await page.locator("input[name='csrfToken']").first().inputValue();
  await page.context().addCookies([{ name: "_csrf", value: token, domain: "localhost", path: "/", httpOnly: true }]);
}

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const categoryId = randomUUID();
    const productId = randomUUID();
    const skuId = randomUUID();

    await client.query(
      `insert into categories (id, name, slug, is_active) values ($1, $2, $3, true) on conflict (slug) do nothing`,
      [categoryId, `E2E Category ${runId}`, categorySlug],
    );
    await client.query(
      `insert into products (id, name, slug, description, category_id, editorial_status) values ($1, $2, $3, $4, $5, 'published') on conflict (slug) do nothing`,
      [productId, productName, productSlug, "Playwright smoke product", categoryId],
    );
    await client.query(
      `insert into skus (id, product_id, sku, variant_label, price_cents, currency, is_active) values ($1, $2, $3, 'Default', 123400, 'USD', true) on conflict (sku) do nothing`,
      [skuId, productId, `E2E-${runId}`],
    );
    await client.query(
      `insert into inventory_items (sku_id, physical_stock, reserved_stock, adjusted_stock) values ($1, 25, 0, 0) on conflict (sku_id) do update set physical_stock = 25, reserved_stock = 0, adjusted_stock = 0`,
      [skuId],
    );

    const zoneId = randomUUID();
    await client.query(
      `insert into shipping_zones (id, name, country_code, regions, is_active) values ($1, 'E2E Chile', 'CHL', null, true)`,
      [zoneId],
    );
    await client.query(
      `insert into shipping_rates (id, zone_id, name, carrier, price_cents, estimated_days_min, estimated_days_max, is_active) values ($1, $2, 'E2E Standard', 'E2E Carrier', 3990, 2, 4, true)`,
      [randomUUID(), zoneId],
    );
    await client.query(
      `insert into tax_rules (id, country_code, region, tax_class, rate_percent, name, is_inclusive, is_active) values ($1, 'CHL', null, 'standard', '19.00', 'IVA E2E', true, true)`,
      [randomUUID()],
    );
  } finally {
    await client.end();
  }
});

test("E2E-01 home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Home \| Maison/);
  await expect(page.locator("body")).toContainText("Maison");
});

test("E2E-02 PLP search shows products", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent(productName)}`);
  await expect(page.getByRole("heading", { name: /Resultados/ })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(productName) })).toBeVisible();
});

test("E2E-03 category PLP supports filters and sort", async ({ page }) => {
  await page.goto(`/categories/${categorySlug}?sort=price_asc&inStock=1`);
  await expect(page.getByText(productName)).toBeVisible();
  await expect(page.locator("select[name='sort']")).toHaveValue("price_asc");
  await expect(page.getByRole("checkbox", { name: "Solo en stock" })).toBeChecked();
});

test("E2E-04 PDP shows product details", async ({ page }) => {
  await page.goto(`/products/${productSlug}`);
  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await expect(page.getByText("En stock")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeVisible();
});

test("E2E-05 add to cart works", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText(productName)).toBeVisible();
});

test("E2E-06 update and remove cart item works", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/cart");
  await syncCsrfCookie(page);
  await page.locator("input[name='quantity']").fill("2");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.locator("input[name='quantity']")).toHaveValue("2");
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Tu carrito esta vacio.")).toBeVisible();
});

test("E2E-07 checkout with mock payment completes", async ({ page }) => {
  await setSignedSession(page);
  await page.goto(`/products/${productSlug}`);
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByText("Agregado al carrito")).toBeVisible();
  await page.goto("/cart");
  await page.getByRole("link", { name: "Ir al checkout" }).click();
  await syncCsrfCookie(page);
  await page.locator("input[name='email']").fill(`buyer-${runId}@example.test`);
  await page.locator("input[name='firstName']").fill("E2E");
  await page.locator("input[name='lastName']").fill("Buyer");
  await page.locator("input[name='phone']").fill("+56912345678");
  await page.locator("input[name='line1']").fill("Av Test 123");
  await page.locator("input[name='city']").fill("Santiago");
  await page.locator("input[name='state']").fill("RM");
  await page.locator("input[name='postalCode']").fill("8320000");
  await page.getByRole("button", { name: "Continuar a envio" }).click();
  await expect(page.getByRole("heading", { name: "Metodo de envio" })).toBeVisible();
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Continuar a pago" }).click();
  await expect(page.getByRole("heading", { name: "Confirmar pedido" })).toBeVisible();
  await syncCsrfCookie(page);
  await page.getByRole("button", { name: "Confirmar y pagar" }).click();
  await expect(page.getByRole("heading", { name: "Pedido confirmado!" })).toBeVisible();
});

test("E2E-08 customer login page renders", async ({ page }) => {
  await page.goto("/cuenta/login");
  await expect(page.locator("input[name='email']")).toBeVisible();
  await expect(page.locator("input[name='password']")).toBeVisible();
});

test("E2E-09 admin login page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("input[name='email']")).toBeVisible();
  await expect(page.locator("input[name='password']")).toBeVisible();
});

test("E2E-10 autocomplete and observability endpoints respond", async ({ page }) => {
  await page.goto(`/api/search/suggest?q=${encodeURIComponent(productName)}`);
  await expect(page.locator("body")).toContainText(productName);
  const live = await page.request.get("/health/live");
  expect(live.ok()).toBe(true);
  const metrics = await page.request.get("/metrics");
  expect(metrics.ok()).toBe(true);
  await expect.poll(async () => (await metrics.text()).includes("ecommerce_http_requests_total")).toBe(true);
});
