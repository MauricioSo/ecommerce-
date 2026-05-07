import { describe, test, expect, beforeAll } from "bun:test";

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgres://localhost/test";

import { getConfig } from "../src/shared/infrastructure/config.ts";
import { signAdminToken, verifyAdminToken } from "../src/shared/infrastructure/auth/jwt.ts";

beforeAll(() => {
  getConfig();
});

describe("Admin JWT", () => {
  test("sign and verify valid token", async () => {
    const token = await signAdminToken({ userId: "user-123", role: "super_admin" });
    const payload = await verifyAdminToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-123");
    expect(payload!.role).toBe("super_admin");
    expect(payload!.jti).toBeDefined();
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test("expired token is rejected", async () => {
    const token = await signAdminToken({ userId: "user-123", role: "admin" });
    const parts = token.split(".");
    const body = JSON.parse(atob((parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")));
    body.exp = Math.floor(Date.now() / 1000) - 3600;
    const tamperedBody = btoa(JSON.stringify(body)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const tamperedToken = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    const result = await verifyAdminToken(tamperedToken);
    expect(result).toBeNull();
  });

  test("tampered signature is rejected", async () => {
    const token = await signAdminToken({ userId: "user-123", role: "admin" });
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = await verifyAdminToken(tampered);
    expect(result).toBeNull();
  });

  test("invalid format is rejected", async () => {
    expect(await verifyAdminToken("")).toBeNull();
    expect(await verifyAdminToken("a.b")).toBeNull();
    expect(await verifyAdminToken("a.b.c.d")).toBeNull();
  });

  test("random gibberish token is rejected", async () => {
    expect(await verifyAdminToken("aaa.bbb.ccc")).toBeNull();
  });
});

describe("escapeHtml helper", () => {
  test("escapes all HTML entities", async () => {
    const { escapeHtml } = await import("../src/web/helpers/escape.ts");
    expect(escapeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(escapeHtml("a&b<c>d'e")).toBe("a&amp;b&lt;c&gt;d&#x27;e");
    expect(escapeHtml("normal text")).toBe("normal text");
  });

  test("sanitizeJsonForScript prevents script breakout", async () => {
    const { sanitizeJsonForScript } = await import("../src/web/helpers/escape.ts");
    const malicious = '{"name":"test</script><script>alert(1)</script>"}';
    const safe = sanitizeJsonForScript(malicious);
    expect(safe).not.toContain("</script>");
    expect(safe).toContain("<\\/script>");
  });
});
