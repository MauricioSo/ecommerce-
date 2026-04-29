import { eq, desc } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";
import { createCheckoutSession } from "../domain/entities.ts";
import { calculateCartPrice } from "../../pricing/application/use-cases.ts";
import { createReservation, reserveStock } from "../../inventory/domain/entities.ts";
import * as inventoryRepo from "../../inventory/infrastructure/repository.ts";
import { initiatePaymentUseCase } from "../../payments/application/use-cases.ts";
import { emitEventWithDb } from "../../../shared/infrastructure/outbox/worker.ts";

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
  if (customerId) {
    const existingByCustomer = await repo.findCartByCustomerId(customerId);
    if (existingByCustomer) return existingByCustomer.id;
  }
  let cart = await repo.findCartBySessionId(sessionId);
  if (!cart) {
    const id = crypto.randomUUID();
    await repo.insertCart({ id, sessionId, customerId: customerId ?? null });
    return id;
  }
  if (customerId && !cart.customerId) {
    const { getDb } = await import("../../../shared/infrastructure/db/index.ts");
    const db = getDb();
    const { carts } = await import("../../../shared/infrastructure/db/schema.ts");
    await db.update(carts).set({ customerId }).where(eq(carts.id, cart.id));
    cart = { ...cart, customerId };
  }
  return cart.id;
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

export async function addToCartUseCase(sessionId: string, skuId: string, quantity: number, customerId?: string | null): Promise<void> {
  const cartId = await getOrCreateCart(sessionId, customerId);
  const skuData = await repo.getSkuWithActiveStatus(skuId);
  if (!skuData) throw new Error("SKU not found");
  if (!skuData.isActive) throw new Error("SKU is not available");
  const existing = await repo.findCartItemByCartAndSku(cartId, skuId);
  if (existing) {
    await repo.updateCartItemQuantity(existing.id, existing.quantity + quantity);
  } else {
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
  if (quantity <= 0) {
    await repo.deleteCartItem(itemId);
  } else {
    await repo.updateCartItemQuantity(itemId, quantity);
  }
}

export async function removeCartItemUseCase(itemId: string): Promise<void> {
  await repo.deleteCartItem(itemId);
}

export async function startCheckoutUseCase(sessionId: string, customerId?: string | null): Promise<{ checkoutId: string; idempotencyKey: string }> {
  const { cartId, items } = await getCartWithItems(sessionId, customerId);
  if (items.length === 0) throw new Error("Cart is empty");
  const idempotencyKey = crypto.randomUUID();
  const session = createCheckoutSession({ cartId, idempotencyKey });
  await repo.insertCheckoutSession({
    id: session.id,
    cartId: session.cartId,
    status: session.status,
    idempotencyKey: session.idempotencyKey,
  });
  return { checkoutId: session.id, idempotencyKey };
}

export async function setCheckoutShippingUseCase(checkoutId: string, input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  shippingMethod: string | null;
  shippingCostCents: number;
  countryCode?: string;
  notes?: string;
}): Promise<void> {
  const session = await repo.findCheckoutSessionById(checkoutId);
  if (!session) throw new Error("Checkout session not found");
  if (session.status !== "pending") throw new Error(`Invalid checkout state: ${session.status}`);
  await repo.updateCheckoutSession(checkoutId, {
    status: "shipping_info",
    customerEmail: input.email,
    shippingAddress: input.shippingAddress,
    billingAddress: input.billingAddress ?? input.shippingAddress,
    shippingMethod: input.shippingMethod,
    shippingCostCents: input.shippingCostCents,
    countryCode: input.countryCode ?? null,
    customerPhone: input.phone ?? null,
    customerFirstName: input.firstName ?? null,
    customerLastName: input.lastName ?? null,
    notes: input.notes ?? null,
  });
}

export async function setCheckoutShippingRate(checkoutId: string, input: {
  shippingMethod: string;
  shippingCostCents: number;
  shippingRateId: string;
}): Promise<void> {
  const session = await repo.findCheckoutSessionById(checkoutId);
  if (!session) throw new Error("Checkout session not found");
  await repo.updateCheckoutSession(checkoutId, {
    status: "shipping_selected",
    shippingMethod: input.shippingMethod,
    shippingCostCents: input.shippingCostCents,
  });
}

export async function getCheckoutSession(checkoutId: string) {
  return repo.findCheckoutSessionById(checkoutId);
}

export async function findLatestPendingCheckout(sessionId: string) {
  const cart = await repo.findCartBySessionId(sessionId);
  if (!cart) return null;
  const db = getDb();
  const sessions = await db.select().from(s.checkoutSessions)
    .where(eq(s.checkoutSessions.cartId, cart.id))
    .orderBy(desc(s.checkoutSessions.createdAt));
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sess = sessions[i]!;
    if (sess.status !== "completed" && sess.status !== "expired") return sess;
  }
  return null;
}

export async function getCheckoutReview(checkoutId: string) {
  const session = await repo.findCheckoutSessionById(checkoutId);
  if (!session) throw new Error("Checkout session not found");
  const items = await repo.findCartItems(session.cartId);
  const cartItems = items.map((r) => ({
    skuId: r.skuId,
    productName: r.productName,
    variantLabel: r.variantLabel,
    quantity: r.quantity,
    unitPriceCents: r.unitPriceCents,
    currency: r.currency,
  }));
  const breakdown = await calculateCartPrice({
    items: cartItems,
    shippingCents: session.shippingCostCents ?? 0,
  });
  return { session, items: cartItems, breakdown };
}

export type ConfirmCheckoutResult = {
  orderId: string;
  orderPublicToken: string;
  paymentStatus: string;
  paymentAttemptId: string | null;
  totalCents: number;
  currency: string;
};

export async function confirmCheckoutUseCase(checkoutId: string): Promise<ConfirmCheckoutResult> {
  const db = getDb();
  const session = await repo.findCheckoutSessionById(checkoutId);
  if (!session) throw new Error("Checkout session not found");
  if (session.status !== "shipping_info" && session.status !== "shipping_selected") throw new Error(`Checkout must be in shipping_info state`);

  const items = await repo.findCartItems(session.cartId);
  if (items.length === 0) throw new Error("Cart is empty");

  const cartItems = items.map((r) => ({
    skuId: r.skuId,
    productName: r.productName ?? "Unknown",
    variantLabel: r.variantLabel,
    quantity: r.quantity,
    unitPriceCents: r.unitPriceCents,
    currency: r.currency,
  }));

  const breakdown = await calculateCartPrice({
    items: cartItems,
    shippingCents: session.shippingCostCents ?? 0,
  });

  // Resolve customerId: prefer cart owner, fall back to email lookup
  const [cartRow] = await db.select({ customerId: s.carts.customerId })
    .from(s.carts).where(eq(s.carts.id, session.cartId)).limit(1);
  let customerId: string | null = cartRow?.customerId ?? null;
  if (!customerId && session.customerEmail) {
    const { findCustomerByEmail } = await import("../../customers/infrastructure/repository.ts");
    const customer = await findCustomerByEmail(session.customerEmail);
    customerId = customer?.id ?? null;
  }

  const orderId = crypto.randomUUID();
  const orderPublicToken = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const t = inventoryRepo.asDb(tx);
    for (const item of items) {
      const inventoryItem = await inventoryRepo.ensureInventoryItem(item.skuId, t);
      const reservation = createReservation({
        skuId: item.skuId,
        quantity: item.quantity,
        checkoutSessionId: checkoutId,
      });
      const reserved = reserveStock(inventoryItem, item.quantity);
      await inventoryRepo.saveInventoryItem(reserved.item, t);
      await inventoryRepo.saveLedgerEntry({
        ...reserved.ledger,
        referenceId: reservation.id,
      }, t);
      await inventoryRepo.saveReservation(reservation, t);
    }

    await tx.insert(s.orders).values({
      id: orderId,
      checkoutSessionId: checkoutId,
      publicToken: orderPublicToken,
      customerId: customerId ?? undefined,
      customerEmail: session.customerEmail,
      status: "pending",
      subtotalCents: breakdown.subtotal.amount,
      discountCents: breakdown.discount.amount,
      shippingCostCents: breakdown.shipping.amount,
      taxCents: breakdown.tax.amount,
      totalCents: breakdown.total.amount,
      currency: breakdown.total.currency,
      shippingAddress: session.shippingAddress,
      billingAddress: session.billingAddress,
      shippingMethod: session.shippingMethod,
      snapshot: { items: cartItems },
    });

    for (const ci of cartItems) {
      await tx.insert(s.orderItems).values({
        id: crypto.randomUUID(),
        orderId,
        skuId: ci.skuId,
        productName: ci.productName,
        variantLabel: ci.variantLabel,
        quantity: ci.quantity,
        unitPriceCents: ci.unitPriceCents,
        totalPriceCents: ci.unitPriceCents * ci.quantity,
        currency: ci.currency,
      });
    }

    await tx.delete(s.cartItems).where(eq(s.cartItems.cartId, session.cartId));
    await tx.update(s.checkoutSessions).set({ status: "completed", updatedAt: new Date() }).where(eq(s.checkoutSessions.id, checkoutId));

    await emitEventWithDb(tx, {
      aggregateType: "order",
      aggregateId: orderId,
      eventType: "order_created",
      payload: {
        orderId,
        customerEmail: session.customerEmail ?? null,
        totalCents: breakdown.total.amount,
        currency: breakdown.total.currency,
      },
    });
  });

  try {
    const payment = await initiatePaymentUseCase({
      orderId,
      amountCents: breakdown.total.amount,
      currency: breakdown.total.currency,
      idempotencyKey: session.idempotencyKey ?? crypto.randomUUID(),
    });

    return {
      orderId,
      orderPublicToken,
      paymentStatus: payment.status,
      paymentAttemptId: payment.attemptId,
      totalCents: breakdown.total.amount,
      currency: breakdown.total.currency,
    };
  } catch (error) {
    await db.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "order",
      aggregateId: orderId,
      eventType: "payment_initiation_failed",
      payload: { message: error instanceof Error ? error.message : "Unknown payment initiation error" },
      actorId: null,
      correlationId: null,
    });

    return {
      orderId,
      orderPublicToken,
      paymentStatus: "failed",
      paymentAttemptId: null,
      totalCents: breakdown.total.amount,
      currency: breakdown.total.currency,
    };
  }
}

export async function getCartItemCount(sessionId: string, customerId?: string | null): Promise<number> {
  let cart = customerId ? await repo.findCartByCustomerId(customerId) : null;
  if (!cart) cart = await repo.findCartBySessionId(sessionId);
  if (!cart) return 0;
  const items = await repo.findCartItems(cart.id);
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
