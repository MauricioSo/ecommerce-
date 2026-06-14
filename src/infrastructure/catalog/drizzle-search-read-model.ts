import { eq, and, sql, inArray, desc, asc } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import type { CatalogSearchReadModel } from "../../application/catalog/ports/catalog-search-read-model.ts";
import type { SearchFilters, SearchResult, PaginatedResults, AggRow } from "../../application/catalog/search-use-cases.ts";
import { sortAggRows } from "../../application/catalog/search-use-cases.ts";

type Db = ReturnType<typeof getDb>;

function buildPublishedProductWhere(filters: SearchFilters): ReturnType<typeof eq> | ReturnType<typeof and> {
  const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof sql>> = [eq(s.products.editorialStatus, "published")];

  if (filters.categoryId) {
    conditions.push(eq(s.products.categoryId, filters.categoryId));
  }

  if (filters.query) {
    const q = `%${filters.query.toLowerCase()}%`;
    conditions.push(
      sql`(${sql`LOWER(${s.products.name}) LIKE ${q}`} OR ${sql`LOWER(COALESCE(${s.products.description}, '')) LIKE ${q}`})`,
    );
  }

  return conditions.length > 1 ? and(...conditions) : conditions[0]!;
}

export class DrizzleCatalogSearchReadModel implements CatalogSearchReadModel {
  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async searchPublishedProducts(
    filters: SearchFilters,
    pageSize: number,
    offset: number,
  ): Promise<{ products: SearchResult[]; total: number }> {
    const db = this.db;
    const where = buildPublishedProductWhere(filters);

    let orderBy;
    switch (filters.sortBy) {
      case "name_asc": orderBy = asc(s.products.name); break;
      case "name_desc": orderBy = desc(s.products.name); break;
      case "newest": orderBy = desc(s.products.createdAt); break;
      default: orderBy = desc(s.products.createdAt);
    }

    const [products, countResult] = await Promise.all([
      db.select().from(s.products).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(s.products).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = await this.enrichProducts(products as Array<{ id: string; name: string; slug: string; description: string | null; baseImage: string | null; categoryId: string | null }>);

    return { products: items, total };
  }

  async searchWithAggregation(
    filters: SearchFilters,
    page: number,
    pageSize: number,
    offset: number,
  ): Promise<PaginatedResults> {
    const db = this.db;
    const havingParts: ReturnType<typeof sql>[] = [];

    if (filters.minPriceCents !== undefined) {
      havingParts.push(sql`MIN(${s.skus.priceCents}) >= ${filters.minPriceCents}`);
    }
    if (filters.maxPriceCents !== undefined) {
      havingParts.push(sql`MIN(${s.skus.priceCents}) <= ${filters.maxPriceCents}`);
    }
    if (filters.inStock) {
      havingParts.push(sql`COALESCE(SUM(${s.inventoryItems.physicalStock} - ${s.inventoryItems.reservedStock} + ${s.inventoryItems.adjustedStock}), 0) > 0`);
    }

    const havingExpr = havingParts.length === 1
      ? havingParts[0]
      : havingParts.length > 1
        ? and(...havingParts)
        : undefined;

    const where = and(eq(s.skus.isActive, true), buildPublishedProductWhere(filters));

    const baseQuery = () =>
      db
        .select({
          productId: s.skus.productId,
          minPrice: sql<number>`MIN(${s.skus.priceCents})`,
          maxPrice: sql<number>`MAX(${s.skus.priceCents})`,
          totalStock: sql<number>`COALESCE(SUM(${s.inventoryItems.physicalStock} - ${s.inventoryItems.reservedStock} + ${s.inventoryItems.adjustedStock}), 0)`,
          skuCount: sql<number>`COUNT(DISTINCT ${s.skus.id})`,
          currency: sql<string>`MIN(${s.skus.currency})`,
          createdAt: sql<Date>`MIN(${s.products.createdAt})`,
        })
        .from(s.skus)
        .innerJoin(s.products, eq(s.skus.productId, s.products.id))
        .leftJoin(s.inventoryItems, eq(s.inventoryItems.skuId, s.skus.id))
        .where(where)
        .groupBy(s.skus.productId);

    const allRows = havingExpr
      ? await baseQuery().having(havingExpr) as unknown as AggRow[]
      : await baseQuery() as unknown as AggRow[];

    let sorted = sortAggRows(allRows, filters.sortBy);
    const total = sorted.length;

    if ((filters.sortBy === "name_asc" || filters.sortBy === "name_desc") && allRows.length > 0) {
      const productIds = allRows.map((r: AggRow) => r.productId);
      const nameOrder = await this.fetchProductNames(productIds, filters.sortBy === "name_asc" ? "asc" : "desc");
      sorted = allRows.sort((a: AggRow, b: AggRow) => {
        const orderA = nameOrder.get(a.productId) ?? 0;
        const orderB = nameOrder.get(b.productId) ?? 0;
        return orderA - orderB;
      });
    }

    const pageRows = sorted.slice(offset, offset + pageSize);

    if (pageRows.length === 0) {
      return { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    const productIds = pageRows.map((r: AggRow) => r.productId);
    type ProductRow = { id: string; name: string; slug: string; description: string | null; baseImage: string | null; categoryId: string | null };
    const products = await db.select().from(s.products).where(inArray(s.products.id, productIds)) as ProductRow[];
    const pMap = new Map<string, ProductRow>(products.map((p) => [p.id, p]));

    const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean) as string[])];
    type CategoryRow = { id: string; name: string; slug: string };
    const categories = catIds.length > 0
      ? await db.select().from(s.categories).where(inArray(s.categories.id, catIds)) as CategoryRow[]
      : [];
    const catMap = new Map<string, CategoryRow>(categories.map((c) => [c.id, c]));

    const items: SearchResult[] = pageRows.map((row: AggRow) => {
      const p = pMap.get(row.productId);
      const cat = p?.categoryId ? catMap.get(p.categoryId) : null;
      return {
        id: row.productId,
        name: p?.name ?? "",
        slug: p?.slug ?? "",
        description: p?.description ?? null,
        baseImage: p?.baseImage ?? null,
        categoryName: cat?.name ?? null,
        categorySlug: cat?.slug ?? null,
        minPriceCents: Number(row.minPrice ?? 0),
        maxPriceCents: Number(row.maxPrice ?? 0),
        currency: row.currency ?? "CLP",
        totalStock: Number(row.totalStock ?? 0),
        skuCount: Number(row.skuCount ?? 0),
      };
    });

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async fetchProductNames(
    productIds: string[],
    direction: "asc" | "desc",
  ): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const products = await this.db
      .select({ id: s.products.id, name: s.products.name })
      .from(s.products)
      .where(inArray(s.products.id, productIds)) as Array<{ id: string; name: string }>;
    const sorted = products.sort((a: { name: string }, b: { name: string }) => direction === "asc"
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
    );
    return new Map(sorted.map((p: { id: string }, i: number) => [p.id, i]));
  }

  async enrichProducts(
    products: Array<{ id: string; name: string; slug: string; description: string | null; baseImage: string | null; categoryId: string | null }>,
  ): Promise<SearchResult[]> {
    if (products.length === 0) return [];

    const db = this.db;
    const productIds = products.map((p) => p.id);

    const allSkus = await db.select().from(s.skus).where(inArray(s.skus.productId, productIds)) as Array<{ id: string; productId: string; priceCents: number; currency: string; isActive: boolean }>;
    const skuIds = allSkus.map((sk) => sk.id);
    const allInv = skuIds.length > 0
      ? await db.select().from(s.inventoryItems).where(inArray(s.inventoryItems.skuId, skuIds)) as Array<{ skuId: string; physicalStock: number; reservedStock: number; adjustedStock: number }>
      : [];

    const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean) as string[])];
    const categories = catIds.length > 0
      ? await db.select().from(s.categories).where(inArray(s.categories.id, catIds)) as Array<{ id: string; name: string; slug: string }>
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return products.map((p) => {
      const skus = allSkus.filter((sk) => sk.productId === p.id);
      const cat = p.categoryId ? catMap.get(p.categoryId) : null;

      let totalStock = 0;
      for (const sku of skus) {
        const inv = allInv.find((i) => i.skuId === sku.id);
        totalStock += inv ? Math.max(0, inv.physicalStock - inv.reservedStock + inv.adjustedStock) : 0;
      }

      const prices = skus.filter((sk) => sk.isActive).map((sk) => sk.priceCents);

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        baseImage: p.baseImage,
        categoryName: cat?.name ?? null,
        categorySlug: cat?.slug ?? null,
        minPriceCents: prices.length > 0 ? Math.min(...prices) : 0,
        maxPriceCents: prices.length > 0 ? Math.max(...prices) : 0,
        currency: skus[0]?.currency ?? "CLP",
        totalStock,
        skuCount: skus.length,
      };
    });
  }

  async searchAutocomplete(
    query: string,
    limit: number,
  ): Promise<Array<{ name: string; slug: string; image: string | null; price: number }>> {
    const q = `%${query.toLowerCase()}%`;
    const results = await this.db
      .select({
        id: s.products.id,
        name: s.products.name,
        slug: s.products.slug,
        image: s.products.baseImage,
        minPrice: sql<number>`MIN(${s.skus.priceCents})`,
      })
      .from(s.products)
      .innerJoin(s.skus, and(eq(s.skus.productId, s.products.id), eq(s.skus.isActive, true)))
      .where(and(eq(s.products.editorialStatus, "published"), sql`LOWER(${s.products.name}) LIKE ${q}`))
      .groupBy(s.products.id)
      .limit(limit) as Array<{ name: string; slug: string; image: string | null; minPrice: number }>;

    return results.map((r) => ({
      name: r.name,
      slug: r.slug,
      image: r.image,
      price: Number(r.minPrice ?? 0),
    }));
  }

  async findCategoryIdBySlug(slug: string): Promise<string | undefined> {
    const rows = await this.db.select().from(s.categories).where(eq(s.categories.slug, slug)).limit(1) as Array<{ id: string }>;
    return rows[0]?.id;
  }
}
