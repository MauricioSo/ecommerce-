import type { CatalogSearchReadModel } from "./ports/catalog-search-read-model.ts";
import { DrizzleCatalogSearchReadModel } from "../../infrastructure/catalog/drizzle-search-read-model.ts";

export type SearchFilters = {
  query?: string;
  categoryId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
  sortBy?: "name_asc" | "name_desc" | "price_asc" | "price_desc" | "newest";
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  baseImage: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  minPriceCents: number;
  maxPriceCents: number;
  currency: string;
  totalStock: number;
  skuCount: number;
};

export type PaginatedResults = {
  items: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AggRow = {
  productId: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  skuCount: number;
  currency: string;
  createdAt: Date;
};

const defaultReadModel: CatalogSearchReadModel = new DrizzleCatalogSearchReadModel();

function resolveReadModel(rm?: CatalogSearchReadModel): CatalogSearchReadModel {
  return rm ?? defaultReadModel;
}

export async function searchProductsUseCase(filters: SearchFilters, rm?: CatalogSearchReadModel): Promise<PaginatedResults> {
  const model = resolveReadModel(rm);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));

  const needsAgg =
    filters.minPriceCents !== undefined ||
    filters.maxPriceCents !== undefined ||
    filters.inStock === true ||
    filters.sortBy === "price_asc" ||
    filters.sortBy === "price_desc";

  const offset = (page - 1) * pageSize;

  if (needsAgg) {
    return model.searchWithAggregation(filters, page, pageSize, offset);
  }

  const { products, total } = await model.searchPublishedProducts(filters, pageSize, offset);

  return { items: products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export function sortAggRows(rows: AggRow[], sortBy?: string): AggRow[] {
  const copy = [...rows];
  switch (sortBy) {
    case "price_asc":
      return copy.sort((a, b) => a.minPrice - b.minPrice || a.productId.localeCompare(b.productId));
    case "price_desc":
      return copy.sort((a, b) => b.maxPrice - a.maxPrice || a.productId.localeCompare(b.productId));
    case "name_asc":
    case "name_desc":
      return copy;
    default:
      return copy.sort((a, b) => {
        const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return tb - ta || a.productId.localeCompare(b.productId);
      });
  }
}

export async function searchAutocompleteUseCase(query: string, limit = 5, rm?: CatalogSearchReadModel): Promise<{ name: string; slug: string; image: string | null; price: number }[]> {
  if (!query || query.length < 2) return [];
  const model = resolveReadModel(rm);
  return model.searchAutocomplete(query, limit);
}

export async function getProductListPage(filters: Omit<SearchFilters, "query"> & { categorySlug?: string }, rm?: CatalogSearchReadModel): Promise<PaginatedResults> {
  const model = resolveReadModel(rm);
  if (filters.categorySlug) {
    const categoryId = await model.findCategoryIdBySlug(filters.categorySlug);
    if (categoryId) filters.categoryId = categoryId;
  }
  return searchProductsUseCase(filters, model);
}
