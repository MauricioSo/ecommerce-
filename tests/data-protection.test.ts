import { describe, test, expect } from "bun:test";
import { redact } from "../src/shared/infrastructure/logger/index.ts";

describe("Log redaction", () => {
  test("redacts email field", () => {
    const result = redact({ email: "user@test.com" });
    expect(result).toEqual({ email: "[REDACTED]" });
  });

  test("redacts password field", () => {
    const result = redact({ password: "secret123" });
    expect(result).toEqual({ password: "[REDACTED]" });
  });

  test("redacts nested sensitive data", () => {
    const result = redact({ user: { name: "John", phone: "+1234567890" } });
    expect(result).toEqual({ user: { name: "John", phone: "[REDACTED]" } });
  });

  test("does not modify non-sensitive data", () => {
    const input = { orderId: "abc123", status: "pending", total: 5000 };
    const result = redact(input);
    expect(result).toEqual(input);
  });

  test("redacts token and secret fields", () => {
    const result = redact({ token: "abc", secret: "xyz", other: "ok" });
    expect(result).toEqual({ token: "[REDACTED]", secret: "[REDACTED]", other: "ok" });
  });

  test("handles null and undefined", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  test("handles arrays", () => {
    const result = redact([{ email: "a@b.com" }, { name: "ok" }]);
    expect(result).toEqual([{ email: "[REDACTED]" }, { name: "ok" }]);
  });

  test("redacts documentNumber", () => {
    const result = redact({ documentNumber: "12345678-9" });
    expect(result).toEqual({ documentNumber: "[REDACTED]" });
  });

  test("preserves original object", () => {
    const input = { email: "test@test.com" };
    const result = redact(input);
    expect(input.email).toBe("test@test.com");
    expect((result as Record<string, unknown>).email).toBe("[REDACTED]");
  });
});
