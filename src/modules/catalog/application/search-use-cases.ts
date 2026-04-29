import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

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

export async function searchProductsUseCase(filters: SearchFilters): Promise<PaginatedResults> {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));

  const needsAgg =
    filters.minPriceCents !== undefined ||
    filters.maxPriceCents !== undefined ||
    filters.inStock === true ||
    filters.sortBy === "price_asc" ||
    filters.sortBy === "price_desc";

  let conditions = [eq(s.products.editorialStatus, "published")];

  if (filters.categoryId) {
    conditions.push(eq(s.products.categoryId, filters.categoryId));
  }

  if (filters.query) {
    const q = `%${filters.query.toLowerCase()}%`;
    conditions.push(
      sql`(${sql`LOWER(${s.products.name}) LIKE ${q}`} OR ${sql`LOWER(COALESCE(${s.products.description}, '')) LIKE ${q}`})`
    );
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]!;
  const offset = (page - 1) * pageSize;

  if (needsAgg) {
    return searchWithAggregation(db, filters, where, page, pageSize, offset);
  }

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
  const items = await enrichProducts(db, products);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

type AggRow = {
  productId: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  skuCount: number;
  currency: string;
  createdAt: Date;
};

async function searchWithAggregation(
  db: ReturnType<typeof getDb>,
  filters: SearchFilters,
  where: ReturnType<typeof eq> | ReturnType<typeof and>,
  page: number,
  pageSize: number,
  offset: number,
): Promise<PaginatedResults> {
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

  let q = db
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
    .where(and(eq(s.skus.isActive, true), where))
    .groupBy(s.skus.productId);

  const allRows = havingExpr
    ? await q.having(havingExpr) as unknown as AggRow[]
    : await q as unknown as AggRow[];

  let sorted = sortAggRows(allRows, filters.sortBy);
  const total = sorted.length;

  if ((filters.sortBy === "name_asc" || filters.sortBy === "name_desc") && allRows.length > 0) {
    const productIds = allRows.map((r) => r.productId);
    const nameOrder = await sortProductsByName(db, productIds, filters.sortBy === "name_asc" ? "asc" : "desc");
    sorted = allRows.sort((a, b) => {
      const orderA = nameOrder.get(a.productId) ?? 0;
      const orderB = nameOrder.get(b.productId) ?? 0;
      return orderA - orderB;
    });
  }

  const pageRows = sorted.slice(offset, offset + pageSize);

  if (pageRows.length === 0) {
    return { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  const productIds = pageRows.map((r) => r.productId);
  const products = await db.select().from(s.products).where(inArray(s.products.id, productIds));
  const pMap = new Map(products.map((p) => [p.id, p]));

  const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean) as string[])];
  const categories = catIds.length > 0
    ? await db.select().from(s.categories).where(inArray(s.categories.id, catIds))
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const items: SearchResult[] = pageRows.map((row) => {
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

function sortAggRows(rows: AggRow[], sortBy?: string): AggRow[] {
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

async function sortProductsByName(
  db: ReturnType<typeof getDb>,
  productIds: string[],
  direction: "asc" | "desc"
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const products = await db
    .select({ id: s.products.id, name: s.products.name })
    .from(s.products)
    .where(inArray(s.products.id, productIds));
  const sorted = products.sort((a, b) => direction === "asc"
    ? a.name.localeCompare(b.name)
    : b.name.localeCompare(a.name)
  );
  return new Map(sorted.map((p, i) => [p.id, i]));
}

async function enrichProducts(
  db: ReturnType<typeof getDb>,
  products: { id: string; name: string; slug: string; description: string | null; baseImage: string | null; categoryId: string | null }[],
): Promise<SearchResult[]> {
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  const allSkus = await db.select().from(s.skus).where(inArray(s.skus.productId, productIds));
  const skuIds = allSkus.map((sk) => sk.id);
  const allInv = skuIds.length > 0
    ? await db.select().from(s.inventoryItems).where(inArray(s.inventoryItems.skuId, skuIds))
    : [];

  const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean) as string[])];
  const categories = catIds.length > 0
    ? await db.select().from(s.categories).where(inArray(s.categories.id, catIds))
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

export async function searchAutocompleteUseCase(query: string, limit = 5): Promise<{ name: string; slug: string; image: string | null; price: number }[]> {
  if (!query || query.length < 2) return [];
  const db = getDb();
  const q = `%${query.toLowerCase()}%`;
  const results = await db
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
    .limit(limit);

  return results.map((r) => ({
    name: r.name,
    slug: r.slug,
    image: r.image,
    price: Number(r.minPrice ?? 0),
  }));
}

export async function getProductListPage(filters: Omit<SearchFilters, "query"> & { categorySlug?: string }): Promise<PaginatedResults> {
  if (filters.categorySlug) {
    const db = getDb();
    const rows = await db.select().from(s.categories).where(eq(s.categories.slug, filters.categorySlug)).limit(1);
    if (rows[0]) filters.categoryId = rows[0].id;
  }
  return searchProductsUseCase(filters);
}
