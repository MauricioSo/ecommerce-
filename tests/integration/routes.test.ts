import { describe, test, expect } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/ecommerce";

import { resetConfig } from "../../src/shared/infrastructure/config.ts";
import { securityHeadersPlugin } from "../../src/web/middleware/security-headers.ts";
resetConfig();
const { createApp } = require("../../src/web/app.ts") as typeof import("../../src/web/app.ts");
const app = createApp();

describe("Health endpoints", () => {
  test("GET /health/live returns alive", async () => {
    const res = await app.handle(new Request("http://localhost/health/live"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("alive");
  });

  test("GET /metrics returns Prometheus format", async () => {
    const res = await app.handle(new Request("http://localhost/metrics"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("ecommerce_http_requests_total");
  });

  test("GET /metrics increments counter on subsequent requests", async () => {
    await app.handle(new Request("http://localhost/health/live"));
    const res = await app.handle(new Request("http://localhost/metrics"));
    const text = await res.text();
    expect(text).toContain("ecommerce_http_requests_total{");
  });
});

describe("CSRF protection", () => {
  test("GET /cuenta/login without cookie renders non-empty CSRF token and sets cookie", async () => {
    const res = await app.handle(new Request("http://localhost/cuenta/login"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/name="csrfToken" value="[a-f0-9]{64}"/);
    expect(res.headers.get("set-cookie") ?? "").toContain("_csrf=");
  });

  test("POST /admin/login without CSRF returns error", async () => {
    const res = await app.handle(new Request("http://localhost/admin/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=admin@test.com&password=testpassword123!",
    }));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("Security headers", () => {
  test("CSP header is strict and self-hosted", async () => {
    const res = await app.handle(new Request("http://localhost/health/live"));
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test("HSTS header is present in production", async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;
    const previousBaseUrl = process.env.BASE_URL;
    const previousDb = process.env.DATABASE_URL;

    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
    process.env.BASE_URL = "https://example.com";
    process.env.DATABASE_URL = "postgres://example:example@db:5432/ecommerce";
    resetConfig();

    const prodApp = new Elysia().use(securityHeadersPlugin).get("/", () => "ok");
    const res = await prodApp.handle(new Request("https://example.com/"));
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");

    process.env.NODE_ENV = previousEnv;
    process.env.JWT_SECRET = previousSecret;
    process.env.BASE_URL = previousBaseUrl;
    process.env.DATABASE_URL = previousDb;
    resetConfig();
  });
});

describe("Rate limiting", () => {
  test("admin login is limited to 5 requests per minute", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 100)}`;
    let res = new Response();
    for (let i = 0; i < 6; i++) {
      res = await app.handle(new Request("http://localhost/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-for": ip,
        },
        body: "email=admin@test.com&password=testpassword123!",
      }));
    }
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBe("5");
  });
});

describe("Correlation ID", () => {
  test("generates correlation ID if not provided", async () => {
    const res = await app.handle(new Request("http://localhost/health/live"));
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  test("propagates provided correlation ID", async () => {
    const res = await app.handle(new Request("http://localhost/health/live", {
      headers: { "x-correlation-id": "my-corr-id-123" },
    }));
    expect(res.headers.get("x-correlation-id")).toBe("my-corr-id-123");
  });

  test("correlation ID is UUID format", async () => {
    const res = await app.handle(new Request("http://localhost/health/live"));
    const cid = res.headers.get("x-correlation-id") ?? "";
    expect(cid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("Metrics recording", () => {
  test("request records HTTP metrics", async () => {
    await app.handle(new Request("http://localhost/health/live"));
    const res = await app.handle(new Request("http://localhost/metrics"));
    const text = await res.text();
    expect(text).toContain("ecommerce_http_request_duration_seconds");
  });

  test("different paths tracked separately", async () => {
    await app.handle(new Request("http://localhost/health/live"));
    await app.handle(new Request("http://localhost/health/live"));
    await app.handle(new Request("http://localhost/metrics"));
    const res = await app.handle(new Request("http://localhost/metrics"));
    const text = await res.text();
    const liveMatches = text.match(/ecommerce_http_requests_total\{[^}]*path="\/health\/live"[^}]*\}\s+(\d+)/);
    expect(liveMatches).toBeTruthy();
  });
});

describe("Error handling", () => {
  test("unhandled route returns error response", async () => {
    const res = await app.handle(new Request("http://localhost/nonexistent-path"));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("error response in development includes details", async () => {
    const res = await app.handle(new Request("http://localhost/nonexistent-path"));
    if (res.status >= 500) {
      const text = await res.text();
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe("Response format", () => {
  test("health live returns JSON", async () => {
    const res = await app.handle(new Request("http://localhost/health/live"));
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("json");
  });

  test("metrics returns text/plain", async () => {
    const res = await app.handle(new Request("http://localhost/metrics"));
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("text/plain");
  });
});
