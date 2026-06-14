import { eq, and } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export async function findCartBySessionId(sessionId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.carts).where(eq(s.carts.sessionId, sessionId));
  return rows[0] ?? null;
}

export async function findCartByCustomerId(customerId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.carts).where(eq(s.carts.customerId, customerId));
  return rows[0] ?? null;
}

export async function insertCart(input: { id: string; sessionId: string | null; customerId: string | null }, db: Db = getDb()) {
  await db.insert(s.carts).values(input);
}

export async function updateCartTimestamp(id: string, db: Db = getDb()) {
  await db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, id));
}

export async function findCartItems(cartId: string, db: Db = getDb()) {
  return db.select({
    id: s.cartItems.id,
    cartId: s.cartItems.cartId,
    skuId: s.cartItems.skuId,
    quantity: s.cartItems.quantity,
    unitPriceCents: s.cartItems.unitPriceCents,
    currency: s.cartItems.currency,
    createdAt: s.cartItems.createdAt,
    sku: s.skus.sku,
    variantLabel: s.skus.variantLabel,
    productName: s.products.name,
    productSlug: s.products.slug,
    productImage: s.products.baseImage,
    editorialStatus: s.products.editorialStatus,
  }).from(s.cartItems)
    .leftJoin(s.skus, eq(s.cartItems.skuId, s.skus.id))
    .leftJoin(s.products, eq(s.skus.productId, s.products.id))
    .where(eq(s.cartItems.cartId, cartId));
}

export async function findCartItemByCartAndSku(cartId: string, skuId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.cartItems)
    .where(and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.skuId, skuId)));
  return rows[0] ?? null;
}

export async function findCartItemById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.cartItems).where(eq(s.cartItems.id, id));
  return rows[0] ?? null;
}

export async function insertCartItem(input: { id: string; cartId: string; skuId: string; quantity: number; unitPriceCents: number; currency: string }, db: Db = getDb()) {
  await db.insert(s.cartItems).values(input);
}

export async function updateCartItemQuantity(id: string, quantity: number, db: Db = getDb()) {
  await db.update(s.cartItems).set({ quantity }).where(eq(s.cartItems.id, id));
}

export async function deleteCartItem(id: string, db: Db = getDb()) {
  await db.delete(s.cartItems).where(eq(s.cartItems.id, id));
}

export async function findCheckoutSessionById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.checkoutSessions).where(eq(s.checkoutSessions.id, id));
  return rows[0] ?? null;
}

export async function findCheckoutSessionByIdempotencyKey(key: string, db: Db = getDb()) {
  const rows = await db.select().from(s.checkoutSessions).where(eq(s.checkoutSessions.idempotencyKey, key));
  return rows[0] ?? null;
}

export async function insertCheckoutSession(input: {
  id: string;
  cartId: string;
  status: string;
  idempotencyKey: string | null;
}, db: Db = getDb()) {
  await db.insert(s.checkoutSessions).values(input);
}

export async function updateCheckoutSession(id: string, data: {
  status?: string;
  customerEmail?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  shippingMethod?: string | null;
  shippingCostCents?: number | null;
  couponCode?: string | null;
  appliedDiscountCents?: number | null;
  taxCents?: number | null;
  countryCode?: string | null;
  customerPhone?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  notes?: string | null;
}, db: Db = getDb()) {
  await db.update(s.checkoutSessions).set({ ...data, updatedAt: new Date() }).where(eq(s.checkoutSessions.id, id));
}

export async function getSkuPrice(skuId: string, db: Db = getDb()) {
  const rows = await db.select({ priceCents: s.skus.priceCents, currency: s.skus.currency }).from(s.skus).where(eq(s.skus.id, skuId));
  return rows[0] ?? null;
}

export async function getSkuWithActiveStatus(skuId: string, db: Db = getDb()) {
  const rows = await db.select({ priceCents: s.skus.priceCents, currency: s.skus.currency, isActive: s.skus.isActive }).from(s.skus).where(eq(s.skus.id, skuId));
  return rows[0] ?? null;
}
