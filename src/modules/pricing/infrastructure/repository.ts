import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export async function findAllPromotions(db: Db = getDb()) {
  return db.select().from(s.promotionRules).orderBy(desc(s.promotionRules.createdAt));
}

export async function findPromotionById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.promotionRules).where(eq(s.promotionRules.id, id));
  return rows[0] ?? null;
}

export async function insertPromotion(input: {
  id: string;
  name: string;
  type: string;
  discountValue: number;
  discountType: string;
  conditions: Record<string, unknown> | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
}, db: Db = getDb()) {
  await db.insert(s.promotionRules).values(input);
}

export async function updatePromotion(id: string, data: Partial<{
  name: string;
  type: string;
  discountValue: number;
  discountType: string;
  conditions: Record<string, unknown> | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  maxUses: number | null;
}>, db: Db = getDb()) {
  await db.update(s.promotionRules).set(data).where(eq(s.promotionRules.id, id));
}

export async function findActivePromotions(db: Db = getDb()) {
  return db.select().from(s.promotionRules).where(
    and(
      eq(s.promotionRules.isActive, true),
    )
  );
}

export async function findPriceLists(db: Db = getDb()) {
  return db.select().from(s.priceLists).orderBy(desc(s.priceLists.createdAt));
}

export async function insertPriceList(input: {
  id: string;
  name: string;
  currency: string;
}, db: Db = getDb()) {
  await db.insert(s.priceLists).values(input);
}
