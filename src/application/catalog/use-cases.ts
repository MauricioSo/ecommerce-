import { createProduct, createCategory, createAttribute, createSKU, changeEditorialStatus, type Product } from "../../domain/catalog/entities.ts";
import { type EditorialStatus } from "../../domain/catalog/types.ts";
import type { CatalogProductRow, CatalogSkuRow, CatalogCategoryRow } from "./ports/catalog-repository.ts";
import { DrizzleCatalogRepository } from "../../infrastructure/catalog/repository.ts";

const catalogRepository = new DrizzleCatalogRepository();

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getProductList() {
  const r = catalogRepository;
  const products = await r.findAllProducts();
  const result = [];
  for (const p of products) {
    const skus = await r.findSkusByProductId(p.id);
    const cat = p.categoryId ? await r.findCategoryById(p.categoryId) : null;
    result.push({ ...p, skuCount: skus.length, categoryName: cat?.name ?? null });
  }
  return result;
}

export async function getProductDetail(id: string) {
  const r = catalogRepository;
  const product = await r.findProductById(id);
  if (!product) return null;
  const skus = await r.findSkusByProductId(id);
  const attributes = await r.findProductAttributes(id);
  const category = product.categoryId ? await r.findCategoryById(product.categoryId) : null;
  const categoryAttrs = product.categoryId ? await r.findAttributesByCategory(product.categoryId) : [];
  return { product, skus, attributes, category, categoryAttrs };
}

export async function createProductUseCase(input: { name: string; description?: string; categoryId?: string }) {
  const r = catalogRepository;
  const slug = slugify(input.name);
  const existing = await r.findProductBySlug(slug);
  if (existing) throw new Error(`Product with slug "${slug}" already exists`);
  const product = createProduct({ name: input.name, slug, description: input.description, categoryId: input.categoryId });
  await r.insertProduct({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    editorialStatus: product.editorialStatus,
  });
  return product;
}

export async function updateProductUseCase(id: string, input: { name?: string; description?: string; categoryId?: string }) {
  const r = catalogRepository;
  const existing = await r.findProductById(id);
  if (!existing) throw new Error("Product not found");
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  await r.updateProduct(id, updates);
}

export async function changeProductStatusUseCase(id: string, targetStatus: string) {
  const r = catalogRepository;
  const existing = await r.findProductById(id);
  if (!existing) throw new Error("Product not found");
  const status = targetStatus as EditorialStatus;
  const product: Product = { ...existing, attributes: [], editorialStatus: existing.editorialStatus as EditorialStatus, metadata: (existing.metadata as Record<string, unknown>) ?? null };
  const updated = changeEditorialStatus(product, status);
  await r.updateProduct(id, { editorialStatus: updated.editorialStatus });
}

export async function deleteProductUseCase(id: string) {
  await catalogRepository.deleteProduct(id);
}

export async function getCategoryList() {
  return catalogRepository.findAllCategories();
}

export async function getCategoryDetail(id: string) {
  const r = catalogRepository;
  const category = await r.findCategoryById(id);
  if (!category) return null;
  const attributes = await r.findAttributesByCategory(id);
  return { category, attributes };
}

export async function createCategoryUseCase(input: { name: string; parentId?: string; description?: string; sortOrder?: number }) {
  const r = catalogRepository;
  const slug = slugify(input.name);
  const existing = await r.findCategoryBySlug(slug);
  if (existing) throw new Error(`Category with slug "${slug}" already exists`);
  const category = createCategory({ name: input.name, slug, parentId: input.parentId, description: input.description, sortOrder: input.sortOrder });
  await r.insertCategory({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    description: category.description,
    sortOrder: category.sortOrder,
  });
  return category;
}

export async function updateCategoryUseCase(id: string, input: { name?: string; description?: string; sortOrder?: number; isActive?: boolean }) {
  await catalogRepository.updateCategory(id, input);
}

export async function deleteCategoryUseCase(id: string) {
  await catalogRepository.deleteCategory(id);
}

export async function getAttributeList() {
  return catalogRepository.findAllAttributes();
}

export async function createAttributeUseCase(input: { name: string; type: string; options?: string[]; isRequired?: boolean; isFilterable?: boolean }) {
  const r = catalogRepository;
  const slug = slugify(input.name);
  const attribute = createAttribute({ name: input.name, slug, type: input.type as "text" | "number" | "boolean" | "select" | "multi_select" | "color", options: input.options, isRequired: input.isRequired, isFilterable: input.isFilterable });
  await r.insertAttribute({
    id: attribute.id,
    name: attribute.name,
    slug: attribute.slug,
    type: attribute.type,
    options: attribute.options,
    isRequired: attribute.isRequired,
    isFilterable: attribute.isFilterable,
  });
  return attribute;
}

export async function createSkuUseCase(input: { productId: string; sku: string; variantLabel?: string; priceCents: number; currency?: string; compareAtPriceCents?: number }) {
  const r = catalogRepository;
  const product = await r.findProductById(input.productId);
  if (!product) throw new Error("Product not found");
  const sku = createSKU({
    productId: input.productId,
    sku: input.sku,
    priceCents: input.priceCents,
    currency: input.currency,
    variantLabel: input.variantLabel,
    compareAtPriceCents: input.compareAtPriceCents,
  });
  await r.insertSku({
    id: sku.id,
    productId: sku.productId,
    sku: sku.sku,
    variantLabel: sku.variantLabel,
    priceCents: sku.price.amount,
    currency: sku.price.currency,
    compareAtPriceCents: sku.compareAtPrice?.amount ?? null,
    isActive: sku.isActive,
  });
  return sku;
}

export async function updateSkuUseCase(id: string, input: { variantLabel?: string; priceCents?: number; compareAtPriceCents?: number; isActive?: boolean }) {
  await catalogRepository.updateSku(id, input);
}

export async function deleteSkuUseCase(id: string) {
  await catalogRepository.deleteSku(id);
}

export async function setProductAttributeUseCase(productId: string, attributeId: string, value: string) {
  await catalogRepository.setProductAttribute(productId, attributeId, value);
}

export type SitemapEntry = { slug: string; updatedAt: Date | string };

export async function getPublishedProductsForSitemap(): Promise<SitemapEntry[]> {
  return catalogRepository.findPublishedProductSlugs();
}

export type PdpData = {
  product: CatalogProductRow;
  skus: CatalogSkuRow[];
  attributes: unknown[];
  category: CatalogCategoryRow | null;
  skuAvailability: { skuId: string; available: number }[];
  totalStock: number;
};

export async function getProductDetailPage(slug: string): Promise<PdpData | null> {
  const r = catalogRepository;
  const product = await r.findProductBySlug(slug);
  if (!product || product.editorialStatus !== "published") return null;
  const skus = await r.findSkusByProductId(product.id);
  const attributes = await r.findProductAttributes(product.id);
  const category = product.categoryId ? await r.findCategoryById(product.categoryId) : null;
  const skuAvailability: { skuId: string; available: number }[] = [];
  let totalStock = 0;
  for (const sku of skus) {
    const inv = await r.findInventoryBySkuId(sku.id);
    const available = inv ? Math.max(0, inv.physicalStock - inv.reservedStock + inv.adjustedStock) : 0;
    totalStock += available;
    skuAvailability.push({ skuId: sku.id, available });
  }
  return { product, skus, attributes, category, skuAvailability, totalStock };
}
