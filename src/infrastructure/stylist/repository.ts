import { eq, desc, and, isNull } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import type { StylistRecommendation, CatalogProductForStylist, StylistMessage } from "../../domain/stylist/types.ts";
import type { StylistRepository } from "../../application/stylist/ports/stylist-repository.ts";

type Db = ReturnType<typeof getDb>;

export async function findOrCreateConversation(opts: {
  customerId?: string;
  sessionId?: string;
}, db: Db = getDb()) {
  const condition = opts.customerId
    ? eq(s.stylistConversations.customerId, opts.customerId)
    : and(
        eq(s.stylistConversations.sessionId, opts.sessionId ?? ""),
        isNull(s.stylistConversations.customerId)
      );

  const existing = await db
    .select()
    .from(s.stylistConversations)
    .where(condition)
    .orderBy(desc(s.stylistConversations.updatedAt))
    .limit(1);

  if (existing[0]) return existing[0];

  const id = crypto.randomUUID();
  await db.insert(s.stylistConversations).values({
    id,
    customerId: opts.customerId ?? null,
    sessionId: opts.sessionId ?? null,
  });
  const created = await db.select().from(s.stylistConversations).where(eq(s.stylistConversations.id, id));
  if (!created[0]) throw new Error("Failed to create stylist conversation");
  return created[0];
}

export async function getConversationMessages(conversationId: string, db: Db = getDb()) {
  return db
    .select()
    .from(s.stylistMessages)
    .where(eq(s.stylistMessages.conversationId, conversationId))
    .orderBy(s.stylistMessages.createdAt);
}

export async function insertMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string | null;
  recommendations?: StylistRecommendation | null;
}, db: Db = getDb()) {
  const id = crypto.randomUUID();
  await db.insert(s.stylistMessages).values({
    id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    imageBase64: input.imageBase64 ?? null,
    recommendations: (input.recommendations as unknown as Record<string, unknown>) ?? null,
  });
  await db
    .update(s.stylistConversations)
    .set({ updatedAt: new Date() })
    .where(eq(s.stylistConversations.id, input.conversationId));
  return id;
}

export async function resetConversation(opts: {
  customerId?: string;
  sessionId?: string;
}, db: Db = getDb()) {
  const condition = opts.customerId
    ? eq(s.stylistConversations.customerId, opts.customerId)
    : and(
        eq(s.stylistConversations.sessionId, opts.sessionId ?? ""),
        isNull(s.stylistConversations.customerId)
      );

  const convs = await db.select().from(s.stylistConversations).where(condition);
  for (const c of convs) {
    await db.delete(s.stylistMessages).where(eq(s.stylistMessages.conversationId, c.id));
  }
  await db.delete(s.stylistConversations).where(condition);
}

export async function getPublishedProductsForStylist(db: Db = getDb()): Promise<CatalogProductForStylist[]> {
  const products = await db
    .select({
      id: s.products.id,
      name: s.products.name,
      slug: s.products.slug,
      description: s.products.description,
      baseImage: s.products.baseImage,
      categoryName: s.categories.name,
    })
    .from(s.products)
    .leftJoin(s.categories, eq(s.products.categoryId, s.categories.id))
    .where(eq(s.products.editorialStatus, "published"))
    .limit(60);

  const result: CatalogProductForStylist[] = [];

  for (const p of products) {
    const skus = await db
      .select({ priceCents: s.skus.priceCents, currency: s.skus.currency })
      .from(s.skus)
      .where(and(eq(s.skus.productId, p.id), eq(s.skus.isActive, true)))
      .orderBy(s.skus.priceCents)
      .limit(1);

    if (!skus[0]) continue;

    const attrs = await db
      .select({ name: s.attributes.name, value: s.productAttributes.value })
      .from(s.productAttributes)
      .innerJoin(s.attributes, eq(s.productAttributes.attributeId, s.attributes.id))
      .where(eq(s.productAttributes.productId, p.id));

    result.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      categoryName: p.categoryName ?? null,
      priceCents: skus[0].priceCents,
      currency: skus[0].currency,
      baseImage: p.baseImage,
      attributes: attrs,
    });
  }

  return result;
}

export class DrizzleStylistRepository implements StylistRepository {
  constructor(private readonly db: Db = getDb()) {}

  findOrCreateConversation(opts: { customerId?: string; sessionId?: string }) {
    return findOrCreateConversation(opts, this.db);
  }

  async getConversationMessages(conversationId: string): Promise<StylistMessage[]> {
    const rows = await getConversationMessages(conversationId, this.db);
    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      imageBase64: row.imageBase64,
      recommendations: row.recommendations as StylistRecommendation | null,
      createdAt: row.createdAt,
    }));
  }

  insertMessage(input: Parameters<StylistRepository["insertMessage"]>[0]) {
    return insertMessage(input, this.db);
  }

  resetConversation(opts: { customerId?: string; sessionId?: string }) {
    return resetConversation(opts, this.db);
  }

  getPublishedProductsForStylist() {
    return getPublishedProductsForStylist(this.db);
  }
}
