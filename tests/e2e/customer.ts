import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/ecommerce";

const adminEmail = `e2e-admin-${randomUUID().slice(0, 8)}@test.com`;
const customerEmail = `e2e-customer-${randomUUID().slice(0, 8)}@test.com`;
const customerPassword = "E2eCustomer12345!";

async function syncCsrf(page: Page) {
  const token = await page.locator("input[name='csrfToken']").first().inputValue();
  await page.context().addCookies([{ name: "_csrf", value: token, domain: "localhost", path: "/", httpOnly: true }]);
}

async function sql(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try { return await client.query(query, params); } finally { await client.end(); }
}

test.beforeAll(async () => {
  const adminHash = "$2b$12$l65H4jINChJjOrPKZ9FeQe4QNaD.OcvBwRcEuryANQTtlIccBJzYO";
  await sql(`INSERT INTO admin_users (id, email, password_hash, name, role) VALUES ($1, $2, $3, 'E2E Admin', 'super_admin') ON CONFLICT (email) DO NOTHING`, [
    randomUUID(), adminEmail, adminHash,
  ]);
});

test("E2E-CUST-01 customer registration page renders with fields", async ({ page }) => {
  await page.goto("/cuenta/registro");
  await expect(page.locator("input[name='email']")).toBeVisible();
  await expect(page.locator("input[name='password']")).toBeVisible();
  await expect(page.locator("input[name='firstName']")).toBeVisible();
  await expect(page.locator("input[name='lastName']")).toBeVisible();
  await expect(page.locator("input[name='passwordConfirm']")).toBeVisible();
  await expect(page.locator("input[name='consentGiven']")).toBeVisible();
});

test("E2E-CUST-02 customer registration succeeds and redirects to verification", async ({ page }) => {
  await page.goto("/cuenta/registro");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.locator("input[name='passwordConfirm']").fill(customerPassword);
  await page.locator("input[name='firstName']").fill("E2E");
  await page.locator("input[name='lastName']").fill("Customer");
  await page.locator("input[name='consentGiven']").check();
  await page.getByRole("button", { name: /crear cuenta/i }).click();
  await page.waitForURL(/\/cuenta\/verificar/, { timeout: 10000 });
  await expect(page.locator("body")).toBeVisible();
});

test("E2E-CUST-03 customer login with valid credentials redirects to account", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  await expect(page).not.toHaveURL(/\/login/);
});

test("E2E-CUST-04 customer login with wrong password shows error", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill("WrongPassword123!");
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await expect(page.getByText(/incorrecto/i)).toBeVisible();
});

test("E2E-CUST-05 customer account dashboard renders after login", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  const body = await page.locator("body").textContent();
  expect(body).toContain("E2E");
});

test("E2E-CUST-06 customer order history page renders", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  await page.goto("/cuenta/pedidos");
  await expect(page).toHaveURL(/\/cuenta\/pedidos/);
});

test("E2E-CUST-07 customer profile page renders", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  await page.goto("/cuenta/perfil");
  await expect(page.locator("input[name='firstName']")).toBeVisible();
  await expect(page.locator("input[name='lastName']")).toBeVisible();
});

test("E2E-CUST-08 customer addresses page renders", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  await page.goto("/cuenta/direcciones");
  await expect(page).toHaveURL(/\/cuenta\/direcciones/);
});

test("E2E-CUST-09 password recovery page renders", async ({ page }) => {
  await page.goto("/cuenta/recuperar");
  await expect(page.locator("input[name='email']")).toBeVisible();
});

test("E2E-CUST-10 email verification page renders", async ({ page }) => {
  await page.goto("/cuenta/verificar");
  await expect(page.locator("body")).toBeVisible();
});

test("E2E-CUST-11 customer logout clears session and redirects", async ({ page }) => {
  await page.goto("/cuenta/login");
  await syncCsrf(page);
  await page.locator("input[name='email']").fill(customerEmail);
  await page.locator("input[name='password']").fill(customerPassword);
  await page.getByRole("button", { name: /ingresar|login|iniciar/i }).click();
  await page.waitForURL(/\/cuenta/, { timeout: 10000 });
  await syncCsrf(page);
  await page.getByRole("button", { name: /cerrar sesion/i }).click();
  await page.waitForURL(/\/$|\/cuenta\/login/, { timeout: 10000 });
  await page.goto("/cuenta");
  await page.waitForURL(/\/cuenta\/login/, { timeout: 10000 });
});
