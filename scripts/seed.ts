import { getDb } from "../src/shared/infrastructure/db/index.ts";
import * as s from "../src/shared/infrastructure/db/schema.ts";
import { eq } from "drizzle-orm";

const db = getDb();

async function seed() {
  console.log("Seeding database...");

  await db.insert(s.categories).values([
    { name: "Electronics", slug: "electronics", description: "Electronic devices and gadgets", sortOrder: 0, isActive: true },
    { name: "Clothing", slug: "clothing", description: "Apparel and accessories", sortOrder: 1, isActive: true },
  ]).onConflictDoNothing();

  const catRows = await db.select().from(s.categories).where(eq(s.categories.slug, "electronics"));
  const cat1Id = catRows[0]?.id ?? crypto.randomUUID();
  const cat2Id = catRows[0]?.id ?? crypto.randomUUID();

  const attrs = await db.insert(s.attributes).values([
    { name: "Color", slug: "color", type: "select", options: ["Black", "White", "Red", "Blue"], isRequired: false, isFilterable: true },
    { name: "Size", slug: "size", type: "select", options: ["S", "M", "L", "XL"], isRequired: false, isFilterable: true },
  ]).returning().onConflictDoNothing();

  if (attrs.length > 0 && attrs[0]) {
    await db.insert(s.categoryAttributes).values([
      { categoryId: cat1Id, attributeId: attrs[0].id, sortOrder: 0 },
    ]).onConflictDoNothing();
  }

  await db.insert(s.products).values([
    { name: "Wireless Headphones", slug: "wireless-headphones", description: "Premium noise-cancelling wireless headphones", categoryId: cat1Id, editorialStatus: "published" },
    { name: "USB-C Cable", slug: "usb-c-cable", description: "Fast charging USB-C cable, 2m", categoryId: cat1Id, editorialStatus: "draft" },
  ]).onConflictDoNothing();

  const prodRows = await db.select().from(s.products).where(eq(s.products.slug, "wireless-headphones"));
  const prod1Id = prodRows[0]?.id ?? crypto.randomUUID();
  const prod2Id = prodRows[0]?.id ?? crypto.randomUUID();

  await db.insert(s.skus).values([
    { productId: prod1Id, sku: "WH-BLK-001", variantLabel: "Black", priceCents: 7999, currency: "USD", isActive: true },
    { productId: prod1Id, sku: "WH-WHT-001", variantLabel: "White", priceCents: 7999, currency: "USD", isActive: true },
    { productId: prod2Id, sku: "USBC-001", variantLabel: null, priceCents: 1299, currency: "USD", isActive: true },
  ]).onConflictDoNothing();

  const skuRows = await db.select().from(s.skus).where(eq(s.skus.sku, "WH-BLK-001"));
  const sku1Id = skuRows[0]?.id;
  const sku2Id = (await db.select().from(s.skus).where(eq(s.skus.sku, "WH-WHT-001")))[0]?.id;
  const sku3Id = (await db.select().from(s.skus).where(eq(s.skus.sku, "USBC-001")))[0]?.id;

  if (sku1Id) await db.insert(s.inventoryItems).values({ skuId: sku1Id, physicalStock: 100 }).onConflictDoNothing();
  if (sku2Id) await db.insert(s.inventoryItems).values({ skuId: sku2Id, physicalStock: 50 }).onConflictDoNothing();
  if (sku3Id) await db.insert(s.inventoryItems).values({ skuId: sku3Id, physicalStock: 200 }).onConflictDoNothing();

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});