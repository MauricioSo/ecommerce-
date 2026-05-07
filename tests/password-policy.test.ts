import { describe, test, expect } from "bun:test";
import { validatePasswordStrength } from "../src/shared/domain/password.ts";

describe("validatePasswordStrength", () => {
  test("rejects password shorter than 12 chars", () => {
    const result = validatePasswordStrength("Abc123!xyz");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("12");
  });

  test("rejects password without uppercase", () => {
    const result = validatePasswordStrength("abcdefghij123!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("mayuscula"))).toBe(true);
  });

  test("rejects password without lowercase", () => {
    const result = validatePasswordStrength("ABCDEFGHIJ123!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("minuscula"))).toBe(true);
  });

  test("rejects password without number", () => {
    const result = validatePasswordStrength("Abcdefghijxyz!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("numero"))).toBe(true);
  });

  test("rejects password without special character", () => {
    const result = validatePasswordStrength("Abcdefghij123xyz");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("especial"))).toBe(true);
  });

  test("rejects password longer than 128 chars", () => {
    const long = "Aa1!" + "x".repeat(125);
    const result = validatePasswordStrength(long);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("128"))).toBe(true);
  });

  test("rejects common passwords", () => {
    const result = validatePasswordStrength("Password123!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("comun"))).toBe(true);
  });

  test("rejects common password base with extra chars stripped", () => {
    const result = validatePasswordStrength("password123!!");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("comun"))).toBe(true);
  });

  test("accepts valid strong password", () => {
    const result = validatePasswordStrength("Kx9#mP2$vL5nQw8r");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("accepts valid password at exactly 12 chars", () => {
    const result = validatePasswordStrength("Aa1!Bb2@Cc3#");
    expect(result.valid).toBe(true);
  });

  test("accepts valid password at exactly 128 chars", () => {
    const pw = "Aa1!" + "x".repeat(124);
    const result = validatePasswordStrength(pw);
    expect(result.valid).toBe(true);
  });

  test("returns multiple errors at once", () => {
    const result = validatePasswordStrength("abc");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
