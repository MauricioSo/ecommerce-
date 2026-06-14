import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import type { CatalogRepository } from "../../application/catalog/ports/catalog-repository.ts";

type Db = ReturnType<typeof getDb>;

export type ProductRow = typeof s.products.$inferSelect;
export type SKURow = typeof s.skus.$inferSelect;
export type CategoryRow = typeof s.categories.$inferSelect;
export type AttributeRow = typeof s.attributes.$inferSelect;
export type ProductAttributeRow = typeof s.productAttributes.$inferSelect;

export async function findAllProducts(db: Db = getDb()) {
  return db.select().from(s.products).orderBy(desc(s.products.createdAt));
}

export async function findProductById(id: string, db: Db = getDb()): Promise<ProductRow | null> {
  const rows = await db.select().from(s.products).where(eq(s.products.id, id));
  return rows[0] ?? null;
}

export async function findProductBySlug(slug: string, db: Db = getDb()): Promise<ProductRow | null> {
  const rows = await db.select().from(s.products).where(eq(s.products.slug, slug));
  return rows[0] ?? null;
}

export async function insertProduct(input: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  editorialStatus: string;
}, db: Db = getDb()) {
  await db.insert(s.products).values(input);
}

export async function updateProduct(id: string, data: Partial<{
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  editorialStatus: string;
  baseImage: string | null;
  metadata: Record<string, unknown> | null;
}>, db: Db = getDb()) {
  await db.update(s.products).set({ ...data, updatedAt: new Date() }).where(eq(s.products.id, id));
}

export async function deleteProduct(id: string, db: Db = getDb()) {
  await db.delete(s.products).where(eq(s.products.id, id));
}

export async function findProductAttributes(productId: string, db: Db = getDb()) {
  return db.select().from(s.productAttributes).where(eq(s.productAttributes.productId, productId));
}

export async function setProductAttribute(productId: string, attributeId: string, value: string, db: Db = getDb()) {
  await db.insert(s.productAttributes).values({ productId, attributeId, value }).onConflictDoUpdate({
    target: [s.productAttributes.productId, s.productAttributes.attributeId],
    set: { value },
  });
}

export async function removeProductAttribute(productId: string, attributeId: string, db: Db = getDb()) {
  await db.delete(s.productAttributes).where(
    and(eq(s.productAttributes.productId, productId), eq(s.productAttributes.attributeId, attributeId))
  );
}

export async function findAllCategories(db: Db = getDb()) {
  return db.select().from(s.categories).orderBy(s.categories.sortOrder, s.categories.name);
}

export async function findCategoryById(id: string, db: Db = getDb()): Promise<CategoryRow | null> {
  const rows = await db.select().from(s.categories).where(eq(s.categories.id, id));
  return rows[0] ?? null;
}

export async function findCategoryBySlug(slug: string, db: Db = getDb()): Promise<CategoryRow | null> {
  const rows = await db.select().from(s.categories).where(eq(s.categories.slug, slug));
  return rows[0] ?? null;
}

export async function insertCategory(input: {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
}, db: Db = getDb()) {
  await db.insert(s.categories).values(input);
}

export async function updateCategory(id: string, data: Partial<{
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}>, db: Db = getDb()) {
  await db.update(s.categories).set({ ...data, updatedAt: new Date() }).where(eq(s.categories.id, id));
}

export async function deleteCategory(id: string, db: Db = getDb()) {
  await db.delete(s.categories).where(eq(s.categories.id, id));
}

export async function findAllAttributes(db: Db = getDb()) {
  return db.select().from(s.attributes).orderBy(s.attributes.name);
}

export async function findAttributeById(id: string, db: Db = getDb()): Promise<AttributeRow | null> {
  const rows = await db.select().from(s.attributes).where(eq(s.attributes.id, id));
  return rows[0] ?? null;
}

export async function findAttributesByCategory(categoryId: string, db: Db = getDb()) {
  return db
    .select({ id: s.attributes.id, name: s.attributes.name, slug: s.attributes.slug, type: s.attributes.type, options: s.attributes.options, isRequired: s.attributes.isRequired, isFilterable: s.attributes.isFilterable })
    .from(s.categoryAttributes)
    .innerJoin(s.attributes, eq(s.categoryAttributes.attributeId, s.attributes.id))
    .where(eq(s.categoryAttributes.categoryId, categoryId))
    .orderBy(s.categoryAttributes.sortOrder);
}

export async function insertAttribute(input: {
  id: string;
  name: string;
  slug: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  isFilterable: boolean;
}, db: Db = getDb()) {
  await db.insert(s.attributes).values(input);
}

export async function findSkusByProductId(productId: string, db: Db = getDb()) {
  return db.select().from(s.skus).where(eq(s.skus.productId, productId)).orderBy(s.skus.variantLabel);
}

export async function findSkuById(id: string, db: Db = getDb()): Promise<SKURow | null> {
  const rows = await db.select().from(s.skus).where(eq(s.skus.id, id));
  return rows[0] ?? null;
}

export async function insertSku(input: {
  id: string;
  productId: string;
  sku: string;
  variantLabel: string | null;
  priceCents: number;
  currency: string;
  compareAtPriceCents: number | null;
  isActive: boolean;
}, db: Db = getDb()) {
  await db.insert(s.skus).values(input);
}

export async function updateSku(id: string, data: Partial<{
  variantLabel: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isActive: boolean;
}>, db: Db = getDb()) {
  await db.update(s.skus).set({ ...data, updatedAt: new Date() }).where(eq(s.skus.id, id));
}

export async function deleteSku(id: string, db: Db = getDb()) {
  await db.delete(s.skus).where(eq(s.skus.id, id));
}

export async function findInventoryBySkuId(skuId: string, db: Db = getDb()) {
  const [row] = await db.select().from(s.inventoryItems).where(eq(s.inventoryItems.skuId, skuId)).limit(1);
  return row ?? null;
}

export async function findPublishedProductSlugs(db: Db = getDb()): Promise<Array<{ slug: string; updatedAt: Date | string }>> {
  return db
    .select({ slug: s.products.slug, updatedAt: s.products.updatedAt })
    .from(s.products)
    .where(eq(s.products.editorialStatus, "published"))
    .orderBy(desc(s.products.updatedAt));
}

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: Db = getDb()) {}

  findAllProducts() { return findAllProducts(this.db); }
  findProductById(id: string) { return findProductById(id, this.db); }
  findProductBySlug(slug: string) { return findProductBySlug(slug, this.db); }
  async insertProduct(input: Record<string, unknown>) { await insertProduct(input as Parameters<typeof insertProduct>[0], this.db); }
  async updateProduct(id: string, updates: Record<string, unknown>) { await updateProduct(id, updates, this.db); }
  async deleteProduct(id: string) { await deleteProduct(id, this.db); }
  findProductAttributes(productId: string) { return findProductAttributes(productId, this.db); }
  async setProductAttribute(productId: string, attributeId: string, value: string) { await setProductAttribute(productId, attributeId, value, this.db); }
  findAllCategories() { return findAllCategories(this.db); }
  findCategoryById(id: string) { return findCategoryById(id, this.db); }
  findCategoryBySlug(slug: string) { return findCategoryBySlug(slug, this.db); }
  async insertCategory(input: Record<string, unknown>) { await insertCategory(input as Parameters<typeof insertCategory>[0], this.db); }
  async updateCategory(id: string, input: Record<string, unknown>) { await updateCategory(id, input, this.db); }
  async deleteCategory(id: string) { await deleteCategory(id, this.db); }
  findAllAttributes() { return findAllAttributes(this.db); }
  findAttributesByCategory(categoryId: string) { return findAttributesByCategory(categoryId, this.db); }
  async insertAttribute(input: Record<string, unknown>) { await insertAttribute(input as Parameters<typeof insertAttribute>[0], this.db); }
  findSkusByProductId(productId: string) { return findSkusByProductId(productId, this.db); }
  async insertSku(input: Record<string, unknown>) { await insertSku(input as Parameters<typeof insertSku>[0], this.db); }
  async updateSku(id: string, input: Record<string, unknown>) { await updateSku(id, input, this.db); }
  async deleteSku(id: string) { await deleteSku(id, this.db); }
  findInventoryBySkuId(skuId: string) { return findInventoryBySkuId(skuId, this.db); }
  findPublishedProductSlugs() { return findPublishedProductSlugs(this.db); }
}
