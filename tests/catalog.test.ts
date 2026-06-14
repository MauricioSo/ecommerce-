import { describe, test, expect } from "bun:test";

process.env.NODE_ENV = "development";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgres://localhost/test";

import { sortAggRows } from "../src/application/catalog/search-use-cases.ts";

type AggRow = {
  productId: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  skuCount: number;
  currency: string;
  createdAt: Date;
};

describe("sortAggRows", () => {
  const rows: AggRow[] = [
    { productId: "a", minPrice: 5000, maxPrice: 8000, totalStock: 10, skuCount: 2, currency: "CLP", createdAt: new Date("2026-01-01") },
    { productId: "b", minPrice: 2000, maxPrice: 3000, totalStock: 5, skuCount: 1, currency: "CLP", createdAt: new Date("2026-01-02") },
    { productId: "c", minPrice: 10000, maxPrice: 15000, totalStock: 20, skuCount: 3, currency: "CLP", createdAt: new Date("2026-01-03") },
  ];

  test("price_asc ordena de menor a mayor precio", () => {
    const sorted = sortAggRows(rows, "price_asc");
    expect(sorted[0]!.productId).toBe("b");
    expect(sorted[1]!.productId).toBe("a");
    expect(sorted[2]!.productId).toBe("c");
  });

  test("price_desc ordena de mayor a menor precio", () => {
    const sorted = sortAggRows(rows, "price_desc");
    expect(sorted[0]!.productId).toBe("c");
    expect(sorted[1]!.productId).toBe("a");
    expect(sorted[2]!.productId).toBe("b");
  });

  test("default ordena por createdAt desc (newest)", () => {
    const sorted = sortAggRows(rows);
    expect(sorted[0]!.productId).toBe("c");
    expect(sorted[1]!.productId).toBe("b");
    expect(sorted[2]!.productId).toBe("a");
  });

  test("newest ordena por createdAt desc", () => {
    const sorted = sortAggRows(rows, "newest");
    expect(sorted[0]!.productId).toBe("c");
    expect(sorted[2]!.productId).toBe("a");
  });

  test("does not mutate original array", () => {
    const original = [...rows];
    sortAggRows(rows, "price_asc");
    expect(rows.map((r) => r.productId)).toEqual(original.map((r) => r.productId));
  });
});
