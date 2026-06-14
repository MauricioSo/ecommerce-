import { Money } from "../../shared/domain/money.ts";
import { type PromotionType, type DiscountType } from "./types.ts";

export type PriceList = {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
};

export type PromotionRule = {
  readonly id: string;
  readonly name: string;
  readonly type: PromotionType;
  readonly discountValue: number;
  readonly discountType: DiscountType;
  readonly conditions: Record<string, unknown> | null;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly isActive: boolean;
  readonly maxUses: number | null;
  readonly usedCount: number;
  readonly createdAt: Date;
};

export type PriceBreakdown = {
  readonly subtotal: Money;
  readonly discount: Money;
  readonly shipping: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly appliedPromotions: AppliedPromotion[];
};

export type AppliedPromotion = {
  readonly promotionId: string;
  readonly name: string;
  readonly description: string;
  readonly discountAmount: Money;
};

export function createPriceList(input: {
  name: string;
  currency?: string;
}): PriceList {
  if (!input.name.trim()) throw new Error("Price list name is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    currency: input.currency ?? "USD",
    isActive: true,
    createdAt: new Date(),
  });
}

export function createPromotionRule(input: {
  name: string;
  type: PromotionType;
  discountValue: number;
  discountType: DiscountType;
  conditions?: Record<string, unknown>;
  startsAt?: Date;
  endsAt?: Date;
  maxUses?: number;
}): PromotionRule {
  if (!input.name.trim()) throw new Error("Promotion name is required");
  if (input.discountValue <= 0) throw new Error("Discount value must be positive");
  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    throw new Error("Promotion start must be before end");
  }
  return Object.freeze({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    discountValue: input.discountValue,
    discountType: input.discountType,
    conditions: input.conditions ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    isActive: true,
    maxUses: input.maxUses ?? null,
    usedCount: 0,
    createdAt: new Date(),
  });
}

export function isPromotionActive(rule: PromotionRule, now: Date = new Date()): boolean {
  if (!rule.isActive) return false;
  if (rule.maxUses !== null && rule.usedCount >= rule.maxUses) return false;
  if (rule.startsAt && now < rule.startsAt) return false;
  if (rule.endsAt && now > rule.endsAt) return false;
  return true;
}

export function calculateDiscount(
  rule: PromotionRule,
  subtotal: Money
): Money {
  if (!rule.isActive) return Money.fromCents(0, subtotal.currency);
  switch (rule.discountType) {
    case "percentage": {
      const amount = Math.floor(subtotal.amount * rule.discountValue / 100);
      return Money.fromCents(Math.min(amount, subtotal.amount), subtotal.currency);
    }
    case "fixed_amount":
      return Money.fromCents(
        Math.min(rule.discountValue, subtotal.amount),
        subtotal.currency
      );
    case "fixed_price":
      if (subtotal.amount > rule.discountValue) {
        return Money.fromCents(subtotal.amount - rule.discountValue, subtotal.currency);
      }
      return Money.fromCents(0, subtotal.currency);
    default:
      return Money.fromCents(0, subtotal.currency);
  }
}

export function buildPriceBreakdown(input: {
  subtotal: Money;
  shipping: Money;
  tax: Money;
  appliedPromotions: AppliedPromotion[];
}): PriceBreakdown {
  const discount = input.appliedPromotions.reduce(
    (sum, p) => sum.add(p.discountAmount),
    Money.fromCents(0, input.subtotal.currency)
  );
  const total = input.subtotal
    .subtract(discount)
    .add(input.shipping)
    .add(input.tax);
  return Object.freeze({
    subtotal: input.subtotal,
    discount,
    shipping: input.shipping,
    tax: input.tax,
    total,
    appliedPromotions: input.appliedPromotions,
  });
}

export function incrementUsage(rule: PromotionRule): PromotionRule {
  return Object.freeze({ ...rule, usedCount: rule.usedCount + 1 });
}
