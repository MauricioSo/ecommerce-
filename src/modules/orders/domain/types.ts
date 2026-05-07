export const OrderStatus = {
  PAYMENT_PENDING: "payment_pending",
  AWAITING_PAYMENT: "awaiting_payment",
  PAYMENT_FAILED: "payment_failed",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  payment_pending: ["awaiting_payment", "payment_failed", "confirmed", "cancelled"],
  awaiting_payment: ["payment_failed", "confirmed", "cancelled"],
  payment_failed: ["awaiting_payment", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransitionTo(current: OrderStatus, target: OrderStatus): boolean {
  return ORDER_TRANSITIONS[current].includes(target);
}

export function assertTransition(current: OrderStatus, target: OrderStatus): void {
  if (!canTransitionTo(current, target)) {
    throw new Error(`Invalid order transition: ${current} -> ${target}`);
  }
}

export const ORDER_FINAL_STATES: OrderStatus[] = ["cancelled", "refunded"];
export const ORDER_PAID_STATES: OrderStatus[] = ["confirmed", "processing", "shipped", "delivered", "refunded"];
