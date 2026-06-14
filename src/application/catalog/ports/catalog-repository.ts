export type CatalogProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  baseImage: string | null;
  categoryId: string | null;
  editorialStatus: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogCategoryRow = {
  id: string;
  name: string;
  slug: string;
};

export type CatalogSkuRow = {
  id: string;
  productId: string;
  sku: string;
  variantLabel: string | null;
  priceCents: number;
  currency: string;
  compareAtPriceCents: number | null;
  isActive: boolean;
};

export type CatalogInventoryRow = {
  skuId: string;
  physicalStock: number;
  reservedStock: number;
  adjustedStock: number;
};

export interface CatalogRepository {
  findAllProducts(): Promise<CatalogProductRow[]>;
  findProductById(id: string): Promise<CatalogProductRow | null>;
  findProductBySlug(slug: string): Promise<CatalogProductRow | null>;
  insertProduct(input: Record<string, unknown>): Promise<void>;
  updateProduct(id: string, updates: Record<string, unknown>): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  findProductAttributes(productId: string): Promise<unknown[]>;
  setProductAttribute(productId: string, attributeId: string, value: string): Promise<void>;
  findAllCategories(): Promise<CatalogCategoryRow[]>;
  findCategoryById(id: string): Promise<CatalogCategoryRow | null>;
  findCategoryBySlug(slug: string): Promise<CatalogCategoryRow | null>;
  insertCategory(input: Record<string, unknown>): Promise<void>;
  updateCategory(id: string, input: Record<string, unknown>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  findAllAttributes(): Promise<unknown[]>;
  findAttributesByCategory(categoryId: string): Promise<unknown[]>;
  insertAttribute(input: Record<string, unknown>): Promise<void>;
  findSkusByProductId(productId: string): Promise<CatalogSkuRow[]>;
  insertSku(input: Record<string, unknown>): Promise<void>;
  updateSku(id: string, input: Record<string, unknown>): Promise<void>;
  deleteSku(id: string): Promise<void>;
  findInventoryBySkuId(skuId: string): Promise<CatalogInventoryRow | null>;
  findPublishedProductSlugs(): Promise<Array<{ slug: string; updatedAt: Date | string }>>;
}
