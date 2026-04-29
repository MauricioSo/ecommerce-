export const CheckoutStatus = {
  PENDING: "pending",
  SHIPPING_INFO: "shipping_info",
  PAYMENT_INFO: "payment_info",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type CheckoutStatus = (typeof CheckoutStatus)[keyof typeof CheckoutStatus];

export const CHECKOUT_TRANSITIONS: Record<CheckoutStatus, CheckoutStatus[]> = {
  pending: ["shipping_info", "cancelled"],
  shipping_info: ["payment_info", "cancelled"],
  payment_info: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["payment_info"],
  cancelled: [],
};
