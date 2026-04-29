import { createPromotionRule, isPromotionActive, calculateDiscount, buildPriceBreakdown, type PromotionRule, type AppliedPromotion, type PriceBreakdown } from "../domain/entities.ts";
import { type DiscountType, type PromotionType } from "../domain/types.ts";
import * as repo from "../infrastructure/repository.ts";
import { Money } from "../../../shared/domain/money.ts";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

export async function getPromotionList() {
  return repo.findAllPromotions();
}

export async function createPromotionUseCase(input: {
  name: string;
  type: string;
  discountValue: number;
  discountType: string;
  conditions?: Record<string, unknown>;
  startsAt?: Date;
  endsAt?: Date;
  maxUses?: number;
}) {
  const rule = createPromotionRule({
    name: input.name,
    type: input.type as PromotionType,
    discountValue: input.discountValue,
    discountType: input.discountType as DiscountType,
    conditions: input.conditions,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    maxUses: input.maxUses,
  });
  await repo.insertPromotion({
    id: rule.id,
    name: rule.name,
    type: rule.type,
    discountValue: rule.discountValue,
    discountType: rule.discountType,
    conditions: rule.conditions,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    maxUses: rule.maxUses,
  });
  return rule;
}

export async function togglePromotionUseCase(id: string) {
  const existing = await repo.findPromotionById(id);
  if (!existing) throw new Error("Promotion not found");
  const newIsActive = !existing.isActive;
  await repo.updatePromotion(id, { isActive: newIsActive });
  await getDb().insert(s.auditEvents).values({
    id: crypto.randomUUID(),
    aggregateType: "promotion",
    aggregateId: id,
    eventType: newIsActive ? "promotion_activated" : "promotion_deactivated",
    payload: { name: existing.name, isActive: newIsActive },
    actorId: null,
    correlationId: null,
  });
}

export async function calculateCartPrice(input: {
  items: Array<{ skuId: string; unitPriceCents: number; quantity: number; currency: string }>;
  shippingCents?: number;
  taxCents?: number;
}): Promise<PriceBreakdown> {
  const currency = input.items[0]?.currency ?? "USD";
  const subtotal = input.items.reduce(
    (sum, i) => sum.add(Money.fromCents(i.unitPriceCents * i.quantity, i.currency)),
    Money.fromCents(0, currency)
  );
  const promotions = await repo.findActivePromotions();
  const applied: AppliedPromotion[] = [];
  for (const p of promotions) {
    const rule: PromotionRule = { ...p, conditions: (p.conditions as Record<string, unknown>) ?? null, discountValue: p.discountValue, discountType: p.discountType as DiscountType, type: p.type as PromotionType, isActive: p.isActive, startsAt: p.startsAt, endsAt: p.endsAt, maxUses: p.maxUses, usedCount: p.usedCount, createdAt: p.createdAt };
    if (!isPromotionActive(rule)) continue;
    const discount = calculateDiscount(rule, subtotal);
    if (discount.isZero()) continue;
    applied.push({
      promotionId: rule.id,
      name: rule.name,
      description: `${rule.discountType === "percentage" ? `${rule.discountValue}% off` : `$${(rule.discountValue / 100).toFixed(2)} off`}`,
      discountAmount: discount,
    });
  }
  return buildPriceBreakdown({
    subtotal,
    shipping: Money.fromCents(input.shippingCents ?? 0, currency),
    tax: Money.fromCents(input.taxCents ?? 0, currency),
    appliedPromotions: applied,
  });
}
