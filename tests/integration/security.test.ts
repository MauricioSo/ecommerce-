import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { escapeHtml, escapeAttr, sanitizeJsonForScript } from "../../src/web/helpers/escape.ts";
import { sanitizeHtml, sanitizeText, hasSqlInjection, sanitizeObject } from "../../src/web/middleware/sanitize.ts";
import { redact } from "../../src/shared/infrastructure/logger/index.ts";

describe("XSS prevention - escapeHtml", () => {
  test("escapeHtml escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
  });

  test("escapeHtml escapes event handlers", () => {
    expect(escapeHtml('<img onerror="alert(1)"')).toBe("&lt;img onerror=&quot;alert(1)&quot;");
  });

  test("escapeHtml escapes all special chars", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#x27;");
  });

  test("escapeAttr escapes double quotes", () => {
    expect(escapeAttr('value "onclick="alert(1)')).toBe("value &quot;onclick=&quot;alert(1)");
  });

  test("sanitizeJsonForScript escapes closing script tags", () => {
    const input = JSON.stringify({ name: "</script><script>alert(1)</script>" });
    expect(sanitizeJsonForScript(input)).not.toContain("</script>");
  });

  test("sanitizeJsonForScript handles normal JSON", () => {
    const input = JSON.stringify({ name: "Hello World" });
    expect(sanitizeJsonForScript(input)).toBe(input);
  });

  test("sanitizeHtml handles nested objects", () => {
    const result = sanitizeObject({ a: { b: "<script>" } });
    expect(result.a.b).toBe("&lt;script&gt;");
  });

  test("sanitizeText returns empty for non-strings", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(42)).toBe("");
  });

  test("escapeHtml handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  test("escapeHtml handles unicode", () => {
    expect(escapeHtml("Hello 世界")).toBe("Hello 世界");
  });

  test("escapeAttr handles empty string", () => {
    expect(escapeAttr("")).toBe("");
  });

  test("sanitizeJsonForScript handles </script> variants", () => {
    const input = JSON.stringify({ x: "</ScRiPt>" });
    expect(sanitizeJsonForScript(input)).not.toMatch(/<\/script>/i);
  });
});

describe("XSS prevention - sanitizeHtml", () => {
  test("escapes / as &#x2F;", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;");
  });

  test("escapes ampersand", () => {
    expect(sanitizeHtml("a&b")).toBe("a&amp;b");
  });

  test("preserves normal text", () => {
    expect(sanitizeHtml("Hello World")).toBe("Hello World");
  });
});

describe("SQL injection detection", () => {
  test("detects DROP TABLE", () => {
    expect(hasSqlInjection("'; DROP TABLE users; --")).toBe(true);
  });

  test("detects SELECT FROM", () => {
    expect(hasSqlInjection("SELECT * FROM users")).toBe(true);
  });

  test("allows normal text", () => {
    expect(hasSqlInjection("Hello world")).toBe(false);
  });

  test("detects UNION SELECT", () => {
    expect(hasSqlInjection("1 UNION SELECT * FROM")).toBe(true);
  });

  test("detects INSERT INTO", () => {
    expect(hasSqlInjection("INSERT INTO users VALUES")).toBe(true);
  });

  test("detects DELETE FROM", () => {
    expect(hasSqlInjection("DELETE FROM users")).toBe(true);
  });

  test("detects UPDATE SET", () => {
    expect(hasSqlInjection("UPDATE users SET")).toBe(true);
  });

  test("detects OR 1=1", () => {
    expect(hasSqlInjection("' OR 1=1--")).toBe(true);
  });

  test("case insensitive detection", () => {
    expect(hasSqlInjection("select * from users")).toBe(true);
    expect(hasSqlInjection("drop table users")).toBe(true);
  });
});

describe("Sanitize object recursive", () => {
  test("handles arrays", () => {
    const result = sanitizeObject({ items: ["<b>bold</b>", "normal"] });
    expect(result.items[0]).toBe("&lt;b&gt;bold&lt;&#x2F;b&gt;");
    expect(result.items[1]).toBe("normal");
  });

  test("handles null values", () => {
    const result = sanitizeObject({ value: null });
    expect(result.value).toBeNull();
  });

  test("handles numeric values", () => {
    const result = sanitizeObject({ count: 42, price: 19.99 });
    expect(result.count).toBe(42);
    expect(result.price).toBe(19.99);
  });

  test("handles boolean values", () => {
    const result = sanitizeObject({ active: true, deleted: false });
    expect(result.active).toBe(true);
    expect(result.deleted).toBe(false);
  });

  test("handles deeply nested objects", () => {
    const result = sanitizeObject({ a: { b: { c: "<script>alert(1)</script>" } } });
    expect(result.a.b.c).toBe("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;");
  });

  test("handles mixed array types recursively", () => {
    const result = sanitizeObject({ data: [1, "safe", null, { x: "<b>" }] });
    expect(result.data[0]).toBe(1);
    expect(result.data[1]).toBe("safe");
    expect(result.data[2]).toBeNull();
    expect((result.data[3] as Record<string, unknown>).x).toBe("&lt;b&gt;");
  });

  test("sanitizes strings in arrays", () => {
    const result = sanitizeObject({ items: ["<script>", "normal"] });
    expect(result.items[0]).toBe("&lt;script&gt;");
    expect(result.items[1]).toBe("normal");
  });

  test("preserves original object", () => {
    const input = { name: "<script>" };
    const result = sanitizeObject(input);
    expect(input.name).toBe("<script>");
    expect(result.name).toBe("&lt;script&gt;");
  });
});

function templateFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...templateFiles(full));
    else if (full.endsWith(".eta")) files.push(full);
  }
  return files;
}

describe("CSP template hygiene", () => {
  const templates = templateFiles(join(process.cwd(), "src", "web", "templates"));

  test("templates do not contain inline event handlers", () => {
    const offenders = templates.filter((file) => /\son(?:click|change|load|error)\s*=/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("templates do not contain htmx js eval attributes", () => {
    const offenders = templates.filter((file) => readFileSync(file, "utf8").includes('hx-vals="js:'));
    expect(offenders).toEqual([]);
  });

  test("templates do not contain inline script blocks", () => {
    const offenders = templates.filter((file) => /<script(?![^>]*\bsrc=)/i.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  test("partials do not render user-controlled raw HTML", () => {
    const emptyState = readFileSync(join(process.cwd(), "src", "web", "templates", "partials", "empty-state.eta"), "utf8");
    expect(emptyState).not.toContain("<%~ it.icon %>");
    expect(emptyState).toContain("<%= it.icon %>");
  });
});

describe("Log redaction", () => {
  test("redacts email", () => {
    expect(redact({ email: "user@test.com" })).toEqual({ email: "[REDACTED]" });
  });

  test("redacts password", () => {
    expect(redact({ password: "secret" })).toEqual({ password: "[REDACTED]" });
  });

  test("redacts nested phone", () => {
    expect(redact({ user: { phone: "+1234" } })).toEqual({ user: { phone: "[REDACTED]" } });
  });

  test("preserves non-sensitive data", () => {
    const input = { orderId: "abc", total: 100 };
    expect(redact(input)).toEqual(input);
  });

  test("redacts token", () => {
    expect(redact({ token: "abc123" })).toEqual({ token: "[REDACTED]" });
  });

  test("redacts secret", () => {
    expect(redact({ secret: "xyz" })).toEqual({ secret: "[REDACTED]" });
  });

  test("handles null and undefined", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  test("handles strings passthrough", () => {
    expect(redact("hello")).toBe("hello");
  });

  test("handles numbers passthrough", () => {
    expect(redact(42)).toBe(42);
  });

  test("redacts in arrays", () => {
    expect(redact([{ email: "a@b.com" }])).toEqual([{ email: "[REDACTED]" }]);
  });
});
