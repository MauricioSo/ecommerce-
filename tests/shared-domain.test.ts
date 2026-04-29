import { describe, test, expect } from "bun:test";
import { Money } from "../src/shared/domain/money.ts";
import { explainBreakdown, type PriceBreakdown } from "../src/shared/domain/price-breakdown.ts";

describe("Money - value object", () => {
  test("creacion desde centavos", () => {
    const m = Money.fromCents(1000, "USD");
    expect(m.amount).toBe(1000);
    expect(m.currency).toBe("USD");
  });

  test("suma correctamente", () => {
    const a = Money.fromCents(500, "USD");
    const b = Money.fromCents(300, "USD");
    const total = a.add(b);
    expect(total.amount).toBe(800);
  });

  test("isZero funciona", () => {
    expect(Money.fromCents(0, "USD").isZero()).toBe(true);
    expect(Money.fromCents(100, "USD").isZero()).toBe(false);
  });

  test("subtract funciona", () => {
    const a = Money.fromCents(1000, "CLP");
    const b = Money.fromCents(300, "CLP");
    const result = a.subtract(b);
    expect(result.amount).toBe(700);
  });

  test("subtract negativo lanza error", () => {
    const a = Money.fromCents(100, "CLP");
    const b = Money.fromCents(200, "CLP");
    expect(() => a.subtract(b)).toThrow("negative");
  });

  test("multiply funciona", () => {
    const m = Money.fromCents(5000, "CLP");
    const result = m.multiply(3);
    expect(result.amount).toBe(15000);
  });
});

describe("PriceBreakdown - explainBreakdown", () => {
  test("genera explicacion legible", () => {
    const bd: PriceBreakdown = {
      subtotalCents: 100000,
      discountCents: 10000,
      taxCents: 17100,
      shippingCents: 5000,
      totalCents: 112100,
      currency: "CLP",
      appliedPromotions: [{ name: "DESC10", type: "percentage", discountCents: 10000, description: "10% off" }],
      isTaxInclusive: false,
      taxRate: 0.19,
      taxName: "IVA",
    };
    const text = explainBreakdown(bd);
    expect(text).toContain("Subtotal");
    expect(text).toContain("Descuento");
    expect(text).toContain("IVA");
    expect(text).toContain("Total");
    expect(text).toContain("DESC10");
  });

  test("sin descuento no muestra linea", () => {
    const bd: PriceBreakdown = {
      subtotalCents: 50000,
      discountCents: 0,
      taxCents: 9500,
      shippingCents: 3000,
      totalCents: 62500,
      currency: "CLP",
      appliedPromotions: [],
      isTaxInclusive: false,
      taxRate: 0.19,
      taxName: "IVA",
    };
    const text = explainBreakdown(bd);
    expect(text).not.toContain("Descuento");
  });
});
