import { Money } from "../../shared/domain/money.ts";
import {
  type OrderStatus,
  assertTransition,
  OrderStatus as OS,
} from "./types.ts";

export type OrderItem = {
  readonly id: string;
  readonly orderId: string;
  readonly skuId: string;
  readonly productId: string | null;
  readonly productName: string;
  readonly variantLabel: string | null;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
};

export type Order = {
  readonly id: string;
  readonly checkoutSessionId: string | null;
  readonly customerId: string | null;
  readonly customerEmail: string | null;
  readonly status: OrderStatus;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly shippingCost: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly shippingAddress: Record<string, unknown> | null;
  readonly billingAddress: Record<string, unknown> | null;
  readonly shippingMethod: string | null;
  readonly snapshot: Record<string, unknown> | null;
  readonly items: OrderItem[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createOrderFromCheckout(input: {
  checkoutSessionId: string;
  customerId?: string;
  customerEmail: string;
  subtotalCents: number;
  discountCents: number;
  shippingCostCents: number;
  taxCents: number;
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  shippingMethod?: string;
  items: Array<{
    skuId: string;
    productId?: string;
    productName: string;
    variantLabel?: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}): Order {
  const currency = input.currency ?? "USD";
  const subtotal = Money.fromCents(input.subtotalCents, currency);
  const discount = Money.fromCents(input.discountCents, currency);
  const shippingCost = Money.fromCents(input.shippingCostCents, currency);
  const tax = Money.fromCents(input.taxCents, currency);
  const total = subtotal.subtract(discount).add(shippingCost).add(tax);

  if (input.items.length === 0) throw new Error("Order must have at least one item");

  const orderId = crypto.randomUUID();
  const items: OrderItem[] = input.items.map((item) => {
    const unitPrice = Money.fromCents(item.unitPriceCents, currency);
    return Object.freeze({
      id: crypto.randomUUID(),
      orderId,
      skuId: item.skuId,
      productId: item.productId ?? null,
      productName: item.productName,
      variantLabel: item.variantLabel ?? null,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice.multiply(item.quantity),
    });
  });

  return Object.freeze({
    id: orderId,
    checkoutSessionId: input.checkoutSessionId,
    customerId: input.customerId ?? null,
    customerEmail: input.customerEmail,
    status: OS.PENDING,
    subtotal,
    discount,
    shippingCost,
    tax,
    total,
    shippingAddress: input.shippingAddress ?? null,
    billingAddress: input.billingAddress ?? null,
    shippingMethod: input.shippingMethod ?? null,
    snapshot: null,
    items,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function transitionOrderTo(order: Order, target: OrderStatus): Order {
  assertTransition(order.status, target);
  return Object.freeze({ ...order, status: target, updatedAt: new Date() });
}

export function confirmOrder(order: Order): Order {
  return transitionOrderTo(order, OS.CONFIRMED);
}

export function startProcessing(order: Order): Order {
  return transitionOrderTo(order, OS.PROCESSING);
}

export function shipOrder(order: Order): Order {
  return transitionOrderTo(order, OS.SHIPPED);
}

export function deliverOrder(order: Order): Order {
  return transitionOrderTo(order, OS.DELIVERED);
}

export function cancelOrder(order: Order): Order {
  return transitionOrderTo(order, OS.CANCELLED);
}

export function refundOrder(order: Order): Order {
  return transitionOrderTo(order, OS.REFUNDED);
}

export function isOrderInFinalState(order: Order): boolean {
  return ["cancelled", "refunded"].includes(order.status);
}

export function isOrderPaid(order: Order): boolean {
  return ["confirmed", "processing", "shipped", "delivered", "refunded"].includes(order.status);
}

export function buildOrderSnapshot(order: Order): Record<string, unknown> {
  return {
    orderId: order.id,
    status: order.status,
    total: order.total.toJSON(),
    items: order.items.map((i) => ({
      skuId: i.skuId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toJSON(),
      totalPrice: i.totalPrice.toJSON(),
    })),
    snapshotAt: new Date().toISOString(),
  };
}
