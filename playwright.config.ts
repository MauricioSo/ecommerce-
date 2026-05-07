import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run index.ts",
    url: "http://localhost:3000/health/live",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "postgres://postgres:postgres@localhost:5434/ecommerce",
      JWT_SECRET: "test-secret-at-least-32-characters-long",
      PAYMENT_PROVIDER: "mock",
      RATE_LIMIT_SCALE: "20",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
