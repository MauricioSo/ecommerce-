import { Money } from "../../shared/domain/money.ts";
import {
  type CheckoutStatus,
  CheckoutStatus as CS,
  CHECKOUT_TRANSITIONS,
} from "./types.ts";

export type Address = {
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
};

export type CartItem = {
  readonly id: string;
  readonly cartId: string;
  readonly skuId: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly createdAt: Date;
};

export type Cart = {
  readonly id: string;
  readonly sessionId: string | null;
  readonly customerId: string | null;
  readonly items: CartItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CheckoutSession = {
  readonly id: string;
  readonly cartId: string;
  readonly status: CheckoutStatus;
  readonly customerEmail: string | null;
  readonly shippingAddress: Address | null;
  readonly billingAddress: Address | null;
  readonly shippingMethod: string | null;
  readonly shippingCost: Money | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createCart(input: {
  sessionId?: string;
  customerId?: string;
}): Cart {
  if (!input.sessionId && !input.customerId) {
    throw new Error("Cart must have sessionId or customerId");
  }
  return Object.freeze({
    id: crypto.randomUUID(),
    sessionId: input.sessionId ?? null,
    customerId: input.customerId ?? null,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function addCartItem(
  cart: Cart,
  input: { skuId: string; quantity: number; unitPriceCents: number; currency?: string }
): Cart {
  if (input.quantity <= 0) throw new Error("Cart item quantity must be positive");
  const currency = input.currency ?? "USD";
  const existing = cart.items.find((i) => i.skuId === input.skuId);
  if (existing) {
    return updateCartItemQuantity(cart, existing.id, existing.quantity + input.quantity);
  }
  const item: CartItem = Object.freeze({
    id: crypto.randomUUID(),
    cartId: cart.id,
    skuId: input.skuId,
    quantity: input.quantity,
    unitPrice: Money.fromCents(input.unitPriceCents, currency),
    createdAt: new Date(),
  });
  return Object.freeze({ ...cart, items: [...cart.items, item], updatedAt: new Date() });
}

export function updateCartItemQuantity(
  cart: Cart,
  itemId: string,
  quantity: number
): Cart {
  if (quantity <= 0) return removeCartItem(cart, itemId);
  const items = cart.items.map((item) =>
    item.id === itemId ? Object.freeze({ ...item, quantity }) : item
  );
  return Object.freeze({ ...cart, items, updatedAt: new Date() });
}

export function removeCartItem(cart: Cart, itemId: string): Cart {
  return Object.freeze({
    ...cart,
    items: cart.items.filter((i) => i.id !== itemId),
    updatedAt: new Date(),
  });
}

export function getCartSubtotal(cart: Cart): Money {
  if (cart.items.length === 0) {
    return Money.fromCents(0, "USD");
  }
  const currency = cart.items[0]!.unitPrice.currency;
  return cart.items.reduce(
    (sum, item) => sum.add(item.unitPrice.multiply(item.quantity)),
    Money.fromCents(0, currency)
  );
}

export function createCheckoutSession(input: {
  cartId: string;
  idempotencyKey?: string;
}): CheckoutSession {
  if (!input.cartId) throw new Error("Checkout session requires a cart");
  return Object.freeze({
    id: crypto.randomUUID(),
    cartId: input.cartId,
    status: CS.PENDING,
    customerEmail: null,
    shippingAddress: null,
    billingAddress: null,
    shippingMethod: null,
    shippingCost: null,
    idempotencyKey: input.idempotencyKey ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function setShippingInfo(
  session: CheckoutSession,
  input: {
    email: string;
    shippingAddress: Address;
    billingAddress?: Address;
    shippingMethod: string;
    shippingCostCents: number;
    currency?: string;
  }
): CheckoutSession {
  assertCheckoutTransition(session.status, CS.SHIPPING_INFO);
  const currency = input.currency ?? "USD";
  return Object.freeze({
    ...session,
    status: CS.SHIPPING_INFO,
    customerEmail: input.email,
    shippingAddress: input.shippingAddress,
    billingAddress: input.billingAddress ?? input.shippingAddress,
    shippingMethod: input.shippingMethod,
    shippingCost: Money.fromCents(input.shippingCostCents, currency),
    updatedAt: new Date(),
  });
}

export function completeCheckout(session: CheckoutSession): CheckoutSession {
  assertCheckoutTransition(session.status, CS.COMPLETED);
  return Object.freeze({ ...session, status: CS.COMPLETED, updatedAt: new Date() });
}

export function failCheckout(session: CheckoutSession): CheckoutSession {
  if (session.status !== CS.PAYMENT_INFO) {
    throw new Error(`Checkout can only fail from payment_info, got ${session.status}`);
  }
  return Object.freeze({ ...session, status: CS.FAILED, updatedAt: new Date() });
}

function assertCheckoutTransition(
  current: CheckoutStatus,
  target: CheckoutStatus
): void {
  const allowed = CHECKOUT_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    throw new Error(`Invalid checkout transition: ${current} -> ${target}`);
  }
}
