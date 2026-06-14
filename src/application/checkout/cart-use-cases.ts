import { eq } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import * as repo from "../../infrastructure/checkout/repository.ts";

export type CartItemView = {
  id: string;
  cartId: string;
  skuId: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
  createdAt: Date;
  sku: string | null;
  variantLabel: string | null;
  productName: string | null;
  productSlug: string | null;
  productImage: string | null;
  lineTotal: number;
};

export async function getOrCreateCart(sessionId: string, customerId?: string | null): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    if (customerId) {
      const byCustomer = await tx.select().from(s.carts)
        .where(eq(s.carts.customerId, customerId)).limit(1);
      if (byCustomer.length > 0) return byCustomer[0]!.id;
    }
    const bySession = await tx.select().from(s.carts)
      .where(eq(s.carts.sessionId, sessionId)).limit(1);
    if (bySession.length > 0) {
      if (customerId && !bySession[0]!.customerId) {
        await tx.update(s.carts).set({ customerId }).where(eq(s.carts.id, bySession[0]!.id));
      }
      return bySession[0]!.id;
    }
    const id = crypto.randomUUID();
    try {
      await tx.insert(s.carts).values({ id, sessionId, customerId: customerId ?? null });
      return id;
    } catch (e: any) {
      if (e?.code === "23505") {
        if (customerId) {
          const retryCustomer = await tx.select().from(s.carts)
            .where(eq(s.carts.customerId, customerId)).limit(1);
          if (retryCustomer.length > 0) return retryCustomer[0]!.id;
        }
        const retrySession = await tx.select().from(s.carts)
          .where(eq(s.carts.sessionId, sessionId)).limit(1);
        if (retrySession.length > 0) return retrySession[0]!.id;
      }
      throw e;
    }
  });
}

export async function getCartWithItems(sessionId: string, customerId?: string | null): Promise<{ cartId: string; items: CartItemView[] }> {
  const cartId = await getOrCreateCart(sessionId, customerId);
  const rows = await repo.findCartItems(cartId);
  const items: CartItemView[] = rows.map((r) => ({
    id: r.id,
    cartId: r.cartId,
    skuId: r.skuId,
    quantity: r.quantity,
    unitPriceCents: r.unitPriceCents,
    currency: r.currency,
    createdAt: r.createdAt,
    sku: r.sku,
    variantLabel: r.variantLabel,
    productName: r.productName,
    productSlug: r.productSlug,
    productImage: r.productImage,
    lineTotal: r.unitPriceCents * r.quantity,
  }));
  return { cartId, items };
}

export const MAX_QUANTITY_PER_SKU = 10;
export const MAX_CART_ITEMS = 20;

export async function addToCartUseCase(sessionId: string, skuId: string, quantity: number, customerId?: string | null): Promise<void> {
  if (quantity > MAX_QUANTITY_PER_SKU) throw new Error(`Maximo ${MAX_QUANTITY_PER_SKU} unidades por producto`);
  const cartId = await getOrCreateCart(sessionId, customerId);
  const skuData = await repo.getSkuWithActiveStatus(skuId);
  if (!skuData) throw new Error("SKU not found");
  if (!skuData.isActive) throw new Error("SKU is not available");
  const existing = await repo.findCartItemByCartAndSku(cartId, skuId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > MAX_QUANTITY_PER_SKU) throw new Error(`Maximo ${MAX_QUANTITY_PER_SKU} unidades por producto`);
    await repo.updateCartItemQuantity(existing.id, newQty);
  } else {
    const cartItems = await repo.findCartItems(cartId);
    if (cartItems.length >= MAX_CART_ITEMS) throw new Error(`Maximo ${MAX_CART_ITEMS} productos diferentes en el carrito`);
    await repo.insertCartItem({
      id: crypto.randomUUID(),
      cartId,
      skuId,
      quantity,
      unitPriceCents: skuData.priceCents,
      currency: skuData.currency,
    });
  }
  await repo.updateCartTimestamp(cartId);
}

export async function updateCartItemUseCase(itemId: string, quantity: number): Promise<void> {
  if (quantity > MAX_QUANTITY_PER_SKU) throw new Error(`Maximo ${MAX_QUANTITY_PER_SKU} unidades por producto`);
  if (quantity <= 0) {
    await repo.deleteCartItem(itemId);
  } else {
    await repo.updateCartItemQuantity(itemId, quantity);
  }
}

export async function removeCartItemUseCase(itemId: string): Promise<void> {
  await repo.deleteCartItem(itemId);
}

export async function migrateGuestCartToCustomer(sessionId: string, customerId: string): Promise<void> {
  const guestCart = await repo.findCartBySessionId(sessionId);
  if (!guestCart) return;
  const customerCart = await repo.findCartByCustomerId(customerId);
  if (!customerCart) {
    await dbUpdateCartOwner(guestCart.id, customerId);
    return;
  }
  if (customerCart.id === guestCart.id) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    const t = tx as unknown as ReturnType<typeof getDb>;
    const guestItems = await repo.findCartItems(guestCart.id, t);
    for (const item of guestItems) {
      const existing = await repo.findCartItemByCartAndSku(customerCart.id, item.skuId, t);
      if (existing) {
        await repo.updateCartItemQuantity(existing.id, Math.min(MAX_QUANTITY_PER_SKU, existing.quantity + item.quantity), t);
      } else {
        await repo.insertCartItem({
          id: crypto.randomUUID(),
          cartId: customerCart.id,
          skuId: item.skuId,
          quantity: Math.min(MAX_QUANTITY_PER_SKU, item.quantity),
          unitPriceCents: item.unitPriceCents,
          currency: item.currency,
        }, t);
      }
    }
    await tx.delete(s.cartItems).where(eq(s.cartItems.cartId, guestCart.id));
    await tx.delete(s.carts).where(eq(s.carts.id, guestCart.id));
    await tx.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, customerCart.id));
  });
}

async function dbUpdateCartOwner(cartId: string, customerId: string): Promise<void> {
  const db = getDb();
  await db.update(s.carts).set({ customerId, sessionId: null, updatedAt: new Date() }).where(eq(s.carts.id, cartId));
}

export async function getCartItemCount(sessionId: string, customerId?: string | null): Promise<number> {
  let cart = customerId ? await repo.findCartByCustomerId(customerId) : null;
  if (!cart) cart = await repo.findCartBySessionId(sessionId);
  if (!cart) return 0;
  const items = await repo.findCartItems(cart.id);
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
