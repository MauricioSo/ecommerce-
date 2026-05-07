import { describe, test, expect, afterEach } from "bun:test";
import { getConfig, resetConfig } from "../src/shared/infrastructure/config.ts";

const originalEnv = { ...process.env };

function resetEnv() {
  const keys = Object.keys(process.env).filter((k) => !Object.hasOwn(originalEnv, k));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(originalEnv)) process.env[k] = v;
}

describe("Config fail-fast", () => {
  afterEach(() => {
    resetEnv();
    resetConfig();
  });

  test("development with defaults passes", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.BASE_URL;
    const config = getConfig();
    expect(config.NODE_ENV).toBe("development");
  });

  test("production with default JWT_SECRET fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "dev-secret-change-in-production";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    expect(() => getConfig()).toThrow(/secure JWT_SECRET/);
  });

  test("production with short JWT_SECRET fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "short";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    expect(() => getConfig()).toThrow(/secure JWT_SECRET/);
  });

  test("production with valid secrets passes", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-secure-secret-key-for-production-use-32chars";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    process.env.PAYMENT_PROVIDER = "mock";
    const config = getConfig();
    expect(config.NODE_ENV).toBe("production");
    expect(config.JWT_SECRET).toBe("a-very-long-and-secure-secret-key-for-production-use-32chars");
  });

  test("production with default DATABASE_URL fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-secure-secret-key-for-production-use-32chars";
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    expect(() => getConfig()).toThrow(/secure JWT_SECRET/);
  });

  test("production with default BASE_URL fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-secure-secret-key-for-production-use-32chars";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "http://localhost:3000";
    expect(() => getConfig()).toThrow(/secure JWT_SECRET/);
  });

  test("production with webpay but no API key fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-secure-secret-key-for-production-use-32chars";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    process.env.PAYMENT_PROVIDER = "webpay";
    delete process.env.TBK_COMMERCE_CODE;
    delete process.env.TBK_API_KEY;
    expect(() => getConfig()).toThrow(/WebPay/);
  });

  test("production with mercadopago but no secret fails", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-very-long-and-secure-secret-key-for-production-use-32chars";
    process.env.DATABASE_URL = "postgres://user:pass@db:5432/ecommerce";
    process.env.BASE_URL = "https://shop.example.com";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_WEBHOOK_SECRET;
    expect(() => getConfig()).toThrow(/MercadoPago/);
  });

  test("DB_SSL env var is parsed", () => {
    process.env.NODE_ENV = "development";
    process.env.DB_SSL = "true";
    const config = getConfig();
    expect(config.DB_SSL).toBe("true");
  });

  test("APP_VERSION defaults to 1.0.0", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_VERSION;
    const config = getConfig();
    expect(config.APP_VERSION).toBe("1.0.0");
  });
});
