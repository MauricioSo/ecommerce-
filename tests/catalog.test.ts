import { describe, test, expect } from "bun:test";
import {
  createProduct,
  createCategory,
  createSKU,
  changeEditorialStatus,
} from "../src/modules/catalog/domain/entities.ts";
import {
  EDITORIAL_TRANSITIONS,
} from "../src/modules/catalog/domain/types.ts";

describe("Catalog - Product", () => {
  test("crea producto con datos validos", () => {
    const p = createProduct({ name: "Camiseta", slug: "camiseta" });
    expect(p.name).toBe("Camiseta");
    expect(p.slug).toBe("camiseta");
    expect(p.editorialStatus).toBe("draft");
    expect(p.id).toBeDefined();
  });

  test("requiere nombre", () => {
    expect(() => createProduct({ name: "", slug: "test" })).toThrow("required");
  });

  test("requiere slug", () => {
    expect(() => createProduct({ name: "Test", slug: "" })).toThrow("required");
  });

  test("crea con descripcion y categoria opcionales", () => {
    const p = createProduct({ name: "Test", slug: "test", description: "Desc", categoryId: "cat-1" });
    expect(p.description).toBe("Desc");
    expect(p.categoryId).toBe("cat-1");
  });

  test("trim espacios en nombre y slug", () => {
    const p = createProduct({ name: "  Test  ", slug: "  TEST  " });
    expect(p.name).toBe("Test");
    expect(p.slug).toBe("test");
  });
});

describe("Catalog - Editorial Status", () => {
  test("draft puede transicionar a review o archived", () => {
    expect(EDITORIAL_TRANSITIONS.draft).toContain("review");
    expect(EDITORIAL_TRANSITIONS.draft).toContain("archived");
    expect(EDITORIAL_TRANSITIONS.draft).not.toContain("published");
  });

  test("review puede transicionar a published", () => {
    expect(EDITORIAL_TRANSITIONS.review).toContain("published");
  });

  test("published puede transicionar a archived", () => {
    expect(EDITORIAL_TRANSITIONS.published).toContain("archived");
  });

  test("changeEditorialStatus permite transicion valida", () => {
    const p = createProduct({ name: "Test", slug: "test" });
    const inReview = changeEditorialStatus(p, "review");
    expect(inReview.editorialStatus).toBe("review");
  });

  test("changeEditorialStatus rechaza transicion invalida", () => {
    const p = createProduct({ name: "Test", slug: "test" });
    expect(() => changeEditorialStatus(p, "published")).toThrow("Cannot transition");
  });
});

describe("Catalog - Category", () => {
  test("crea categoria con datos validos", () => {
    const c = createCategory({ name: "Ropa", slug: "ropa" });
    expect(c.name).toBe("Ropa");
    expect(c.slug).toBe("ropa");
    expect(c.isActive).toBe(true);
    expect(c.sortOrder).toBe(0);
  });

  test("requiere nombre", () => {
    expect(() => createCategory({ name: "", slug: "test" })).toThrow("required");
  });

  test("acepta parentId opcional", () => {
    const c = createCategory({ name: "Polos", slug: "polos", parentId: "parent-1" });
    expect(c.parentId).toBe("parent-1");
  });
});

describe("Catalog - SKU", () => {
  test("crea SKU con datos validos", () => {
    const sku = createSKU({
      productId: "p-1",
      sku: "SKU-001",
      priceCents: 9900,
      currency: "CLP",
    });
    expect(sku.sku).toBe("SKU-001");
    expect(sku.price.amount).toBe(9900);
    expect(sku.price.currency).toBe("CLP");
    expect(sku.isActive).toBe(true);
  });

  test("requiere productId", () => {
    expect(() => createSKU({ productId: "", sku: "SKU-001", priceCents: 100 })).toThrow("belong");
  });

  test("requiere sku code", () => {
    expect(() => createSKU({ productId: "p-1", sku: "", priceCents: 100 })).toThrow("required");
  });

  test("precio negativo lanza error", () => {
    expect(() => createSKU({ productId: "p-1", sku: "SKU", priceCents: -1 })).toThrow("negative");
  });

  test("compareAtPrice se establece correctamente", () => {
    const sku = createSKU({
      productId: "p-1",
      sku: "SKU",
      priceCents: 5000,
      compareAtPriceCents: 8000,
    });
    expect(sku.compareAtPrice).not.toBeNull();
    expect(sku.compareAtPrice!.amount).toBe(8000);
  });

  test("currency default es USD", () => {
    const sku = createSKU({ productId: "p-1", sku: "SKU", priceCents: 100 });
    expect(sku.price.currency).toBe("USD");
  });
});
