import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";

export type CouponValidation = {
  valid: boolean;
  discountCents: number;
  promotionName: string;
  reason?: string;
};

export async function validateCoupon(input: {
  code: string;
  cartSubtotalCents: number;
  customerId?: string;
}): Promise<CouponValidation> {
  const db = getDb();
  const coupon = (await db.select().from(s.couponCodes)
    .where(sql`UPPER(${s.couponCodes.code}) = ${input.code.toUpperCase()}`))[0];
  if (!coupon) return { valid: false, discountCents: 0, promotionName: "", reason: "Cupón no encontrado" };
  if (!coupon.isActive) return { valid: false, discountCents: 0, promotionName: "", reason: "Cupón inactivo" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, discountCents: 0, promotionName: "", reason: "Cupón expirado" };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { valid: false, discountCents: 0, promotionName: "", reason: "Cupón agotado" };
  if (input.customerId) {
    const used = (await db.select().from(s.couponUses)
      .where(and(eq(s.couponUses.couponId, coupon.id), eq(s.couponUses.customerId, input.customerId))))[0];
    if (used) return { valid: false, discountCents: 0, promotionName: "", reason: "Ya usaste este cupón" };
  }
  const promo = (await db.select().from(s.promotionRules).where(eq(s.promotionRules.id, coupon.promotionRuleId)))[0];
  if (!promo || !promo.isActive) return { valid: false, discountCents: 0, promotionName: "", reason: "Promoción no válida" };
  const conditions = promo.conditions as Record<string, unknown> | null;
  if (conditions?.minOrderCents && input.cartSubtotalCents < (conditions.minOrderCents as number)) {
    return { valid: false, discountCents: 0, promotionName: promo.name, reason: `Monto mínimo: $${((conditions.minOrderCents as number) / 100).toLocaleString()}` };
  }
  let discountCents = 0;
  if (promo.discountType === "percentage") {
    discountCents = Math.min(Math.round(input.cartSubtotalCents * promo.discountValue / 100), input.cartSubtotalCents);
  } else if (promo.discountType === "fixed_amount") {
    discountCents = Math.min(promo.discountValue, input.cartSubtotalCents);
  }
  return { valid: true, discountCents, promotionName: promo.name };
}

export async function applyCoupon(input: {
  couponId: string;
  orderId: string;
  customerId?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(s.couponUses).values({
    id: crypto.randomUUID(),
    couponId: input.couponId,
    orderId: input.orderId,
    customerId: input.customerId ?? null,
  });
  await db.update(s.couponCodes)
    .set({ usedCount: sql`${s.couponCodes.usedCount} + 1` })
    .where(eq(s.couponCodes.id, input.couponId));
}

export async function findCouponByCode(code: string) {
  const db = getDb();
  return (await db.select().from(s.couponCodes)
    .where(sql`UPPER(${s.couponCodes.code}) = ${code.toUpperCase()}`))[0] ?? null;
}
