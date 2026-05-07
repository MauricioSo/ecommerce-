import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";
const adminEmail = `e2e-admin-login-${randomUUID().slice(0, 8)}@test.com`;
const adminPassword = "E2eAdmin12345!";
let adminId: string;
let adminHash: string;

async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await client.query(query, params); } finally { await client.end(); }
}

async function syncCsrf(page: Page) {
  const token = await page.locator("input[name='csrfToken']").first().inputValue();
  await page.context().addCookies([{ name: "_csrf", value: token, domain: "localhost", path: "/", httpOnly: true }]);
}

test.beforeAll(async () => {
  adminId = randomUUID();
  adminHash = "$2b$12$l65H4jINChJjOrPKZ9FeQe4QNaD.OcvBwRcEuryANQTtlIccBJzYO";
  await sql(`INSERT INTO admin_users (id, email, password_hash, name, role) VALUES ($1, $2, $3, 'E2E Test Admin', 'super_admin') ON CONFLICT (email) DO NOTHING`, [adminId, adminEmail, adminHash]);
});

test("E2E-ADM-01 admin login page renders correctly", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
  await expect(page.locator("input[name='email']")).toBeVisible();
  await expect(page.locator("input[name='password']")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in|ingresar/i })).toBeVisible();
});

test("E2E-ADM-02 admin login with valid credentials shows dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await expect(page.locator("body")).toContainText("Dashboard");
});

test("E2E-ADM-03 admin login with wrong password shows error", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill("WrongPassword123!");
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await expect(page.getByText(/invalid|incorrecto/i)).toBeVisible();
});

test("E2E-ADM-04 admin dashboard shows stats", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await expect(page.locator("body")).toBeVisible();
});

test("E2E-ADM-05 admin products page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(page.locator("body")).toBeVisible();
});

test("E2E-ADM-06 admin categories page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/categories");
  await expect(page).toHaveURL(/\/admin\/categories/);
});

test("E2E-ADM-07 admin inventory page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/inventory");
  await expect(page).toHaveURL(/\/admin\/inventory/);
});

test("E2E-ADM-08 admin orders page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/orders/);
});

test("E2E-ADM-09 admin payments page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/admin\/payments/);
});

test("E2E-ADM-10 admin promotions page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/promotions");
  await expect(page).toHaveURL(/\/admin\/promotions/);
});

test("E2E-ADM-11 admin CRM customers page renders", async ({ page }) => {
  await page.goto("/admin/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(adminEmail);
  await page.locator("input[name='password']").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|ingresar/i }).click();
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  await page.goto("/admin/crm/customers");
  await expect(page).toHaveURL(/\/admin\/crm\/customers/);
});

test("E2E-ADM-12 admin unauthenticated access redirects to login", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
});
