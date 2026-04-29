import { createProduct, createCategory, createAttribute, createSKU, changeEditorialStatus, type Product } from "../domain/entities.ts";
import { type EditorialStatus } from "../domain/types.ts";
import * as repo from "../infrastructure/repository.ts";

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getProductList() {
  const products = await repo.findAllProducts();
  const result = [];
  for (const p of products) {
    const skus = await repo.findSkusByProductId(p.id);
    const cat = p.categoryId ? await repo.findCategoryById(p.categoryId) : null;
    result.push({ ...p, skuCount: skus.length, categoryName: cat?.name ?? null });
  }
  return result;
}

export async function getProductDetail(id: string) {
  const product = await repo.findProductById(id);
  if (!product) return null;
  const skus = await repo.findSkusByProductId(id);
  const attributes = await repo.findProductAttributes(id);
  const category = product.categoryId ? await repo.findCategoryById(product.categoryId) : null;
  const categoryAttrs = product.categoryId ? await repo.findAttributesByCategory(product.categoryId) : [];
  return { product, skus, attributes, category, categoryAttrs };
}

export async function createProductUseCase(input: { name: string; description?: string; categoryId?: string }) {
  const slug = slugify(input.name);
  const existing = await repo.findProductBySlug(slug);
  if (existing) throw new Error(`Product with slug "${slug}" already exists`);
  const product = createProduct({ name: input.name, slug, description: input.description, categoryId: input.categoryId });
  await repo.insertProduct({
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
  const existing = await repo.findProductById(id);
  if (!existing) throw new Error("Product not found");
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  await repo.updateProduct(id, updates);
}

export async function changeProductStatusUseCase(id: string, targetStatus: string) {
  const existing = await repo.findProductById(id);
  if (!existing) throw new Error("Product not found");
  const status = targetStatus as EditorialStatus;
  const product: Product = { ...existing, attributes: [], editorialStatus: existing.editorialStatus as EditorialStatus, metadata: (existing.metadata as Record<string, unknown>) ?? null };
  const updated = changeEditorialStatus(product, status);
  await repo.updateProduct(id, { editorialStatus: updated.editorialStatus });
}

export async function deleteProductUseCase(id: string) {
  await repo.deleteProduct(id);
}

export async function getCategoryList() {
  return repo.findAllCategories();
}

export async function getCategoryDetail(id: string) {
  const category = await repo.findCategoryById(id);
  if (!category) return null;
  const attributes = await repo.findAttributesByCategory(id);
  return { category, attributes };
}

export async function createCategoryUseCase(input: { name: string; parentId?: string; description?: string; sortOrder?: number }) {
  const slug = slugify(input.name);
  const existing = await repo.findCategoryBySlug(slug);
  if (existing) throw new Error(`Category with slug "${slug}" already exists`);
  const category = createCategory({ name: input.name, slug, parentId: input.parentId, description: input.description, sortOrder: input.sortOrder });
  await repo.insertCategory({
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
  await repo.updateCategory(id, input);
}

export async function deleteCategoryUseCase(id: string) {
  await repo.deleteCategory(id);
}

export async function getAttributeList() {
  return repo.findAllAttributes();
}

export async function createAttributeUseCase(input: { name: string; type: string; options?: string[]; isRequired?: boolean; isFilterable?: boolean }) {
  const slug = slugify(input.name);
  const attribute = createAttribute({ name: input.name, slug, type: input.type as "text" | "number" | "boolean" | "select" | "multi_select" | "color", options: input.options, isRequired: input.isRequired, isFilterable: input.isFilterable });
  await repo.insertAttribute({
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
  const product = await repo.findProductById(input.productId);
  if (!product) throw new Error("Product not found");
  const sku = createSKU({
    productId: input.productId,
    sku: input.sku,
    priceCents: input.priceCents,
    currency: input.currency,
    variantLabel: input.variantLabel,
    compareAtPriceCents: input.compareAtPriceCents,
  });
  await repo.insertSku({
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
  await repo.updateSku(id, input);
}

export async function deleteSkuUseCase(id: string) {
  await repo.deleteSku(id);
}

export async function setProductAttributeUseCase(productId: string, attributeId: string, value: string) {
  await repo.setProductAttribute(productId, attributeId, value);
}
