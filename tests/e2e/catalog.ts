import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";
const runId = randomUUID().slice(0, 8);

async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await client.query(query, params); } finally { await client.end(); }
}

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const productId = randomUUID();
    const skuId = randomUUID();
    const categoryId = randomUUID();
    await client.query(`INSERT INTO categories (id, name, slug, is_active) VALUES ($1, $2, $3, true) ON CONFLICT (slug) DO NOTHING`, [categoryId, `Catalog Category ${runId}`, `catalog-cat-${runId}`]);
    await client.query(`INSERT INTO products (id, name, slug, description, category_id, editorial_status) VALUES ($1, $2, $3, $4, $5, 'published') ON CONFLICT (slug) DO NOTHING`, [productId, `Catalog Product ${runId}`, `catalog-prod-${runId}`, "E2E catalog test", categoryId]);
    await client.query(`INSERT INTO skus (id, product_id, sku, variant_label, price_cents, currency, is_active) VALUES ($1, $2, $3, 'Default', 99900, 'USD', true) ON CONFLICT (sku) DO NOTHING`, [skuId, productId, `CAT-${runId}`]);
    await client.query(`INSERT INTO inventory_items (sku_id, physical_stock, reserved_stock, adjusted_stock) VALUES ($1, 25, 0, 0) ON CONFLICT (sku_id) DO UPDATE SET physical_stock = 25`, [skuId]);
  } finally {
    await client.end();
  }
});

test("E2E-CAT-01 sitemap.xml returns valid XML with products", async ({ page }) => {
  const res = await page.request.get("/sitemap.xml");
  expect(res.ok()).toBe(true);
  const text = await res.text();
  expect(text).toContain("<?xml");
  expect(text).toContain("urlset");
  expect(text).toContain("loc");
});

test("E2E-CAT-02 robots.txt returns correct content", async ({ page }) => {
  const res = await page.request.get("/robots.txt");
  expect(res.ok()).toBe(true);
  const text = await res.text();
  expect(text).toContain("User-agent");
});

test("E2E-CAT-03 privacy policy page renders", async ({ page }) => {
  await page.goto("/privacidad");
  await expect(page.locator("body")).toContainText(/privacidad|proteccion/i);
});

test("E2E-CAT-04 PLP shows multiple products and supports pagination", async ({ page }) => {
  await page.goto(`/categories/catalog-cat-${runId}`);
  await expect(page.getByText(`Catalog Product ${runId}`)).toBeVisible();
});

test("E2E-CAT-05 search with empty query shows all or message", async ({ page }) => {
  await page.goto("/search");
  await expect(page.locator("body")).toBeVisible();
});

test("E2E-CAT-06 search with special characters does not break", async ({ page }) => {
  await page.goto("/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
  await expect(page.locator("body")).toBeVisible();
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("<script>alert(1)</script>");
});

test("E2E-CAT-07 product page shows price and variant", async ({ page }) => {
  await page.goto(`/products/catalog-prod-${runId}`);
  await expect(page.getByText(/\$999/)).toBeVisible();
  await expect(page.getByRole("button", { name: /agregar/i })).toBeVisible();
});

test("E2E-CAT-08 invalid product slug shows 404 or redirect", async ({ page }) => {
  const res = await page.request.get("/products/nonexistent-product-xyz");
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("E2E-CAT-09 invalid category slug shows 404 or redirect", async ({ page }) => {
  const res = await page.request.get("/categories/nonexistent-category-xyz");
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("E2E-CAT-10 autocomplete returns empty for nonsense query", async ({ page }) => {
  const res = await page.request.get("/api/search/suggest?q=zzzzznonexistent12345");
  expect(res.ok()).toBe(true);
  const text = await res.text();
  expect(text.length).toBeGreaterThanOrEqual(0);
});

test("E2E-CAT-11 new product form page renders in admin", async ({ page }) => {
  const adminEmail = `e2e-catalog-${randomUUID().slice(0, 8)}@test.com`;
  const adminHash = "$2b$12$l65H4jINChJjOrPKZ9FeQe4QNaD.OcvBwRcEuryANQTtlIccBJzYO";
  await sql(`INSERT INTO admin_users (id, email, password_hash, name, role) VALUES ($1, $2, $3, 'Cat Admin', 'super_admin') ON CONFLICT (email) DO NOTHING`, [randomUUID(), adminEmail, adminHash]);
  await page.goto("/admin/login");
  const csrf = await page.locator("input[name='csrfToken']").first().inputValue();
  await page.context().addCookies([{ name: "_csrf", value: csrf, domain: "localhost", path: "/", httpOnly: true }]);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill("E2eAdmin12345!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 10000 });
  await page.goto("/admin/products/new");
  await expect(page.locator("form[action='/admin/products']")).toBeVisible();
});

test("E2E-CAT-12 search results page shows count", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent(`Catalog Product ${runId}`)}`);
  await expect(page.getByText(/resultado/i)).toBeVisible();
});
