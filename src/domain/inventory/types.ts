export const ReservationStatus = {
  ACTIVE: "active",
  CONFIRMED: "confirmed",
  RELEASED: "released",
  EXPIRED: "expired",
} as const;

export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  active: ["confirmed", "released", "expired"],
  confirmed: [],
  released: [],
  expired: [],
};

export const LedgerReason = {
  MANUAL_ADJUSTMENT: "manual_adjustment",
  RESERVATION_CREATED: "reservation_created",
  RESERVATION_CONFIRMED: "reservation_confirmed",
  RESERVATION_RELEASED: "reservation_released",
  RESERVATION_EXPIRED: "reservation_expired",
  RETURN_RECEIVED: "return_received",
  STOCK_RECEIPT: "stock_receipt",
  INVENTORY_COUNT: "inventory_count",
} as const;

export type LedgerReason = (typeof LedgerReason)[keyof typeof LedgerReason];
