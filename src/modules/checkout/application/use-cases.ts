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
export const CHECKOUT_TIMEOUT_MS = 30 * 60 * 1000;
const RETRYABLE_ORDER_STATUSES = ["payment_pending", "payment_failed"];

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

  const preSession = await repo.findCheckoutSessionById(checkoutId);
  if (!preSession) throw new Error("Checkout session not found");

  const sessionAge = Date.now() - new Date(preSession.updatedAt).getTime();
  if (sessionAge > CHECKOUT_TIMEOUT_MS) {
    throw new Error("Tu sesion de checkout ha expirado. Por favor inicia nuevamente.");
  }

  const orderId = crypto.randomUUID();
  const orderPublicToken = crypto.randomUUID();
  let result: ConfirmCheckoutResult | undefined;

  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(s.checkoutSessions)
      .where(eq(s.checkoutSessions.id, checkoutId))
      .limit(1)
      .for("update");

    if (!locked) throw new Error("Checkout session not found");

    if (locked.status === "completed") {
      const [existingOrder] = await tx.select().from(s.orders)
        .where(eq(s.orders.checkoutSessionId, checkoutId)).limit(1);
      if (existingOrder) {
        result = {
          orderId: existingOrder.id,
          orderPublicToken: existingOrder.publicToken,
          paymentStatus: existingOrder.status,
          paymentAttemptId: null,
          totalCents: existingOrder.totalCents,
          currency: existingOrder.currency,
        };
        return;
      }
      throw new Error("Checkout already completed but order not found");
    }

    if (locked.status !== "shipping_info" && locked.status !== "shipping_selected") {
      throw new Error(`Checkout must be in shipping_info state`);
    }

    const items = await repo.findCartItems(locked.cartId);
    if (items.length === 0) throw new Error("Cart is empty");

    const cartItems = items.map((r) => ({
      skuId: r.skuId,
      productName: r.productName ?? "Unknown",
      variantLabel: r.variantLabel,
      quantity: r.quantity,
      unitPriceCents: r.unitPriceCents,
      currency: r.currency,
    }));

    for (const item of items) {
      const current = await repo.getSkuWithActiveStatus(item.skuId);
      if (!current || !current.isActive) {
        throw new Error(`Producto ${item.productName ?? item.skuId} ya no esta disponible`);
      }
      if (current.priceCents !== item.unitPriceCents) {
        throw new Error(`El precio de ${item.productName ?? item.skuId} ha cambiado. Por favor revisa tu carrito.`);
      }
    }

    const breakdown = await calculateCartPrice({
      items: cartItems,
      shippingCents: locked.shippingCostCents ?? 0,
    });

    const [cartRow] = await tx.select({ customerId: s.carts.customerId })
      .from(s.carts).where(eq(s.carts.id, locked.cartId)).limit(1);
    let customerId: string | null = cartRow?.customerId ?? null;
    if (!customerId && locked.customerEmail) {
      const { findCustomerByEmail } = await import("../../customers/infrastructure/repository.ts");
      const customer = await findCustomerByEmail(locked.customerEmail);
      customerId = customer?.id ?? null;
    }

    if (customerId) {
      const { findCustomerById } = await import("../../customers/infrastructure/repository.ts");
      const customer = await findCustomerById(customerId);
      if (customer && !customer.emailVerifiedAt) {
        throw new Error("Debes verificar tu email antes de continuar con la compra");
      }
    }

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
      customerEmail: locked.customerEmail,
      status: "payment_pending",
      subtotalCents: breakdown.subtotal.amount,
      discountCents: breakdown.discount.amount,
      shippingCostCents: breakdown.shipping.amount,
      taxCents: breakdown.tax.amount,
      totalCents: breakdown.total.amount,
      currency: breakdown.total.currency,
      shippingAddress: locked.shippingAddress,
      billingAddress: locked.billingAddress,
      shippingMethod: locked.shippingMethod,
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

    await tx.delete(s.cartItems).where(eq(s.cartItems.cartId, locked.cartId));
    await tx.update(s.checkoutSessions).set({ status: "completed", updatedAt: new Date() }).where(eq(s.checkoutSessions.id, checkoutId));

    await emitEventWithDb(tx, {
      aggregateType: "order",
      aggregateId: orderId,
      eventType: "order_created",
      payload: {
        orderId,
        customerEmail: locked.customerEmail ?? null,
        totalCents: breakdown.total.amount,
        currency: breakdown.total.currency,
      },
    });

    result = {
      orderId,
      orderPublicToken,
      paymentStatus: "pending",
      paymentAttemptId: null,
      totalCents: breakdown.total.amount,
      currency: breakdown.total.currency,
    };
  });

  if (!result) throw new Error("Confirm failed unexpectedly");

  try {
    const payment = await initiatePaymentUseCase({
      orderId: result.orderId,
      amountCents: result.totalCents,
      currency: result.currency,
      idempotencyKey: preSession.idempotencyKey ?? crypto.randomUUID(),
    });

    await db.update(s.orders).set({
      status: payment.status === "approved" ? "confirmed" : payment.status === "failed" || payment.status === "rejected" ? "payment_failed" : "awaiting_payment",
      updatedAt: new Date(),
    }).where(eq(s.orders.id, result.orderId));

    return {
      ...result,
      paymentStatus: payment.status,
      paymentAttemptId: payment.attemptId,
    };
  } catch (error) {
    await db.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "order",
      aggregateId: result.orderId,
      eventType: "payment_initiation_failed",
      payload: { message: error instanceof Error ? error.message : "Unknown payment initiation error" },
      actorId: null,
      correlationId: null,
    });

    return {
      ...result,
      paymentStatus: "failed",
      paymentAttemptId: null,
    };
  }
}

export async function retryPaymentForOrderUseCase(input: {
  orderId: string;
  publicToken?: string | null;
  customerId?: string | null;
}): Promise<{ orderId: string; publicToken: string; paymentAttemptId: string; paymentStatus: string; totalCents: number; currency: string }> {
  const db = getDb();
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, input.orderId)).limit(1);
  if (!order) throw new Error("Order not found");
  const ownsOrder = (input.customerId && order.customerId === input.customerId) || (input.publicToken && order.publicToken === input.publicToken);
  if (!ownsOrder) throw new Error("Order not found");
  if (!RETRYABLE_ORDER_STATUSES.includes(order.status)) throw new Error("La orden no permite reintentar pago");
  if (!order.checkoutSessionId) throw new Error("La orden no tiene checkout asociado");

  const reservations = await inventoryRepo.findReservationsByCheckoutSession(order.checkoutSessionId);
  const now = new Date();
  if (reservations.length === 0 || reservations.some((r) => r.status !== "active" || r.expiresAt < now)) {
    throw new Error("La reserva de stock expiro. Por favor inicia el checkout nuevamente.");
  }

  const payment = await initiatePaymentUseCase({
    orderId: order.id,
    amountCents: order.totalCents,
    currency: order.currency,
    idempotencyKey: crypto.randomUUID(),
  });
  await db.update(s.orders).set({
    status: payment.status === "approved" ? "confirmed" : payment.status === "failed" || payment.status === "rejected" ? "payment_failed" : "awaiting_payment",
    updatedAt: new Date(),
  }).where(eq(s.orders.id, order.id));

  return {
    orderId: order.id,
    publicToken: order.publicToken,
    paymentAttemptId: payment.attemptId,
    paymentStatus: payment.status,
    totalCents: order.totalCents,
    currency: order.currency,
  };
}

export async function getCartItemCount(sessionId: string, customerId?: string | null): Promise<number> {
  let cart = customerId ? await repo.findCartByCustomerId(customerId) : null;
  if (!cart) cart = await repo.findCartBySessionId(sessionId);
  if (!cart) return 0;
  const items = await repo.findCartItems(cart.id);
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
