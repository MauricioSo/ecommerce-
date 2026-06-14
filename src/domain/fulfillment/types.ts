export const ShipmentStatus = {
  PENDING: "pending",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ["picked_up", "cancelled"],
  picked_up: ["in_transit"],
  in_transit: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransitionTo(current: ShipmentStatus, target: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[current].includes(target);
}

export function assertTransition(current: ShipmentStatus, target: ShipmentStatus): void {
  if (!canTransitionTo(current, target)) {
    throw new Error(`Invalid shipment transition: ${current} -> ${target}`);
  }
}

export const ReturnStatus = {
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["processing"],
  rejected: [],
  processing: ["completed", "failed"],
  completed: [],
  failed: ["processing"],
};
