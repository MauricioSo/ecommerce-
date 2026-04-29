import { describe, test, expect } from "bun:test";
import { sanitizeHtml, sanitizeText, hasSqlInjection, sanitizeObject } from "../src/web/middleware/sanitize.ts";

describe("Sanitize - HTML", () => {
  test("escapa caracteres HTML peligrosos", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;");
  });

  test("escapa ampersand", () => {
    expect(sanitizeHtml("a&b")).toBe("a&amp;b");
  });

  test("escapa comillas dobles", () => {
    expect(sanitizeHtml('value="test"')).toBe("value=&quot;test&quot;");
  });

  test("deja texto normal sin cambios", () => {
    expect(sanitizeHtml("Hello World")).toBe("Hello World");
  });

  test("sanitizeText con non-string retorna string vacio", () => {
    expect(sanitizeText(123)).toBe("");
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
  });
});

describe("Sanitize - SQL Injection", () => {
  test("detecta patrones SQL basicos", () => {
    expect(hasSqlInjection("'; DROP TABLE users; --")).toBe(true);
    expect(hasSqlInjection("SELECT * FROM users")).toBe(true);
    expect(hasSqlInjection("1 OR 1=1")).toBe(false);
  });

  test("no falsa positivo en texto normal", () => {
    expect(hasSqlInjection("Hello World")).toBe(false);
    expect(hasSqlInjection("Mi producto select")).toBe(true);
  });
});

describe("Sanitize - Object", () => {
  test("sanitiza recursivamente objetos", () => {
    const input = {
      name: "<b>Test</b>",
      tags: ["<script>", "safe"],
      nested: { value: '"; DROP TABLE' },
      number: 42,
    };
    const result = sanitizeObject(input);
    expect(result.name).toBe("&lt;b&gt;Test&lt;&#x2F;b&gt;");
    expect(result.tags[0]).toBe("&lt;script&gt;");
    expect(result.tags[1]).toBe("safe");
    expect(result.nested.value).toBe("&quot;; DROP TABLE");
    expect(result.number).toBe(42);
  });
});
