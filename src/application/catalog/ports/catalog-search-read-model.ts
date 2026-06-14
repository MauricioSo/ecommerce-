import type { SearchFilters, SearchResult, PaginatedResults } from "../search-use-cases.ts";

export interface CatalogSearchReadModel {
  searchPublishedProducts(
    filters: SearchFilters,
    pageSize: number,
    offset: number,
  ): Promise<{ products: SearchResult[]; total: number }>;

  searchWithAggregation(
    filters: SearchFilters,
    page: number,
    pageSize: number,
    offset: number,
  ): Promise<PaginatedResults>;

  searchAutocomplete(
    query: string,
    limit: number,
  ): Promise<{ name: string; slug: string; image: string | null; price: number }[]>;

  findCategoryIdBySlug(slug: string): Promise<string | undefined>;
}
