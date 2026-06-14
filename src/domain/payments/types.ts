export const PaymentStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "failed", "cancelled"],
  processing: ["approved", "rejected", "failed"],
  approved: [],
  rejected: [],
  failed: ["pending"],
  cancelled: [],
};

export function canTransitionTo(current: PaymentStatus, target: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[current].includes(target);
}

export function assertTransition(current: PaymentStatus, target: PaymentStatus): void {
  if (!canTransitionTo(current, target)) {
    throw new Error(`Invalid payment transition: ${current} -> ${target}`);
  }
}

export const RefundStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  pending: ["processing", "rejected"],
  processing: ["approved", "failed"],
  approved: [],
  rejected: [],
  failed: ["pending"],
};

export const PaymentEventType = {
  INTENT_CREATED: "intent_created",
  INTENT_REQUIRES_ACTION: "intent_requires_action",
  INTENT_SUCCEEDED: "intent_succeeded",
  INTENT_FAILED: "intent_failed",
  CHARGE_SUCCEEDED: "charge_succeeded",
  CHARGE_FAILED: "charge_failed",
  CHARGE_REFUNDED: "charge_refunded",
  CHARGE_DISPUTED: "charge_disputed",
} as const;

export type PaymentEventType = (typeof PaymentEventType)[keyof typeof PaymentEventType];

export const PAYMENT_TERMINAL_STATES: PaymentStatus[] = ["approved", "rejected", "cancelled"];
