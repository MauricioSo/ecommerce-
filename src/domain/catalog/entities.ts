import { Money } from "../../shared/domain/money.ts";
import {
  type EditorialStatus,
  type AttributeType,
  EditorialStatus as ES,
  EDITORIAL_TRANSITIONS,
} from "./types.ts";

export type Category = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type Attribute = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: AttributeType;
  readonly options: string[] | null;
  readonly isRequired: boolean;
  readonly isFilterable: boolean;
  readonly createdAt: Date;
};

export type ProductAttribute = {
  readonly productId: string;
  readonly attributeId: string;
  readonly value: string;
};

export type Product = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly editorialStatus: EditorialStatus;
  readonly baseImage: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly attributes: ProductAttribute[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SellableSKU = {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly variantLabel: string | null;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createCategory(input: {
  name: string;
  slug: string;
  parentId?: string;
  description?: string;
  sortOrder?: number;
}): Category {
  if (!input.name.trim()) throw new Error("Category name is required");
  if (!input.slug.trim()) throw new Error("Category slug is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    parentId: input.parentId ?? null,
    description: input.description ?? null,
    sortOrder: input.sortOrder ?? 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function createAttribute(input: {
  name: string;
  slug: string;
  type: AttributeType;
  options?: string[];
  isRequired?: boolean;
  isFilterable?: boolean;
}): Attribute {
  if (!input.name.trim()) throw new Error("Attribute name is required");
  if (!input.slug.trim()) throw new Error("Attribute slug is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    type: input.type,
    options: input.options ?? null,
    isRequired: input.isRequired ?? false,
    isFilterable: input.isFilterable ?? false,
    createdAt: new Date(),
  });
}

export function createProduct(input: {
  name: string;
  slug: string;
  description?: string;
  categoryId?: string;
  baseImage?: string;
  metadata?: Record<string, unknown>;
}): Product {
  if (!input.name.trim()) throw new Error("Product name is required");
  if (!input.slug.trim()) throw new Error("Product slug is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    description: input.description ?? null,
    categoryId: input.categoryId ?? null,
    editorialStatus: ES.DRAFT,
    baseImage: input.baseImage ?? null,
    metadata: input.metadata ?? null,
    attributes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function createSKU(input: {
  productId: string;
  sku: string;
  priceCents: number;
  currency?: string;
  variantLabel?: string;
  compareAtPriceCents?: number;
}): SellableSKU {
  if (!input.productId) throw new Error("SKU must belong to a product");
  if (!input.sku.trim()) throw new Error("SKU code is required");
  if (input.priceCents < 0) throw new Error("SKU price cannot be negative");
  const currency = input.currency ?? "USD";
  return Object.freeze({
    id: crypto.randomUUID(),
    productId: input.productId,
    sku: input.sku.trim().toUpperCase(),
    variantLabel: input.variantLabel ?? null,
    price: Money.fromCents(input.priceCents, currency),
    compareAtPrice: input.compareAtPriceCents != null
      ? Money.fromCents(input.compareAtPriceCents, currency)
      : null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function changeEditorialStatus(
  product: Product,
  target: EditorialStatus
): Product {
  const allowed = EDITORIAL_TRANSITIONS[product.editorialStatus];
  if (!allowed.includes(target)) {
    throw new Error(
      `Cannot transition product from ${product.editorialStatus} to ${target}`
    );
  }
  return Object.freeze({ ...product, editorialStatus: target, updatedAt: new Date() });
}

export function publishProduct(product: Product): Product {
  if (product.attributes.length === 0 && product.categoryId) {
    throw new Error("Product must have attributes to be published");
  }
  return changeEditorialStatus(product, ES.PUBLISHED);
}

export function setProductAttributes(
  product: Product,
  attributes: ProductAttribute[]
): Product {
  return Object.freeze({ ...product, attributes, updatedAt: new Date() });
}
