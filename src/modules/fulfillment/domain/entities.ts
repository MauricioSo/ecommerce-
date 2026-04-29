import {
  type ShipmentStatus,
  type ReturnStatus,
  ShipmentStatus as SS,
  ReturnStatus as RTS,
  assertTransition,
} from "./types.ts";

export type Shipment = {
  readonly id: string;
  readonly orderId: string;
  readonly trackingCode: string | null;
  readonly carrier: string | null;
  readonly status: ShipmentStatus;
  readonly shippedAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ReturnRequest = {
  readonly id: string;
  readonly orderId: string;
  readonly orderItemId: string;
  readonly reason: string;
  readonly status: ReturnStatus;
  readonly customerId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function createShipment(input: { orderId: string; carrier?: string }): Shipment {
  if (!input.orderId) throw new Error("Shipment requires an order");
  return Object.freeze({
    id: crypto.randomUUID(),
    orderId: input.orderId,
    trackingCode: null,
    carrier: input.carrier ?? null,
    status: SS.PENDING,
    shippedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function pickupShipment(shipment: Shipment): Shipment {
  assertShipmentTransition(shipment.status, SS.PICKED_UP);
  return Object.freeze({
    ...shipment,
    status: SS.PICKED_UP,
    shippedAt: new Date(),
    updatedAt: new Date(),
  });
}

export function markInTransit(shipment: Shipment): Shipment {
  assertShipmentTransition(shipment.status, SS.IN_TRANSIT);
  return Object.freeze({ ...shipment, status: SS.IN_TRANSIT, updatedAt: new Date() });
}

export function markOutForDelivery(shipment: Shipment): Shipment {
  assertShipmentTransition(shipment.status, SS.OUT_FOR_DELIVERY);
  return Object.freeze({ ...shipment, status: SS.OUT_FOR_DELIVERY, updatedAt: new Date() });
}

export function deliverShipment(shipment: Shipment): Shipment {
  assertShipmentTransition(shipment.status, SS.DELIVERED);
  return Object.freeze({
    ...shipment,
    status: SS.DELIVERED,
    deliveredAt: new Date(),
    updatedAt: new Date(),
  });
}

export function cancelShipment(shipment: Shipment): Shipment {
  assertShipmentTransition(shipment.status, SS.CANCELLED);
  return Object.freeze({ ...shipment, status: SS.CANCELLED, updatedAt: new Date() });
}

export function setTrackingCode(shipment: Shipment, trackingCode: string): Shipment {
  return Object.freeze({ ...shipment, trackingCode, updatedAt: new Date() });
}

function assertShipmentTransition(current: ShipmentStatus, target: ShipmentStatus): void {
  assertTransition(current, target);
}

export function createReturnRequest(input: {
  orderId: string;
  orderItemId: string;
  reason: string;
  customerId?: string;
}): ReturnRequest {
  if (!input.orderId) throw new Error("Return requires an order");
  if (!input.orderItemId) throw new Error("Return requires an order item");
  if (!input.reason.trim()) throw new Error("Return reason is required");
  return Object.freeze({
    id: crypto.randomUUID(),
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    reason: input.reason.trim(),
    status: RTS.REQUESTED,
    customerId: input.customerId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function approveReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== RTS.REQUESTED) {
    throw new Error(`Invalid return transition: ${ret.status} -> approved`);
  }
  return Object.freeze({ ...ret, status: RTS.APPROVED, updatedAt: new Date() });
}

export function rejectReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== RTS.REQUESTED) {
    throw new Error(`Invalid return transition: ${ret.status} -> rejected`);
  }
  return Object.freeze({ ...ret, status: RTS.REJECTED, updatedAt: new Date() });
}

export function startReturnProcessing(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== RTS.APPROVED && ret.status !== RTS.FAILED) {
    throw new Error(`Invalid return transition: ${ret.status} -> processing`);
  }
  return Object.freeze({ ...ret, status: RTS.PROCESSING, updatedAt: new Date() });
}

export function completeReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== RTS.PROCESSING) {
    throw new Error(`Invalid return transition: ${ret.status} -> completed`);
  }
  return Object.freeze({ ...ret, status: RTS.COMPLETED, updatedAt: new Date() });
}

export function failReturn(ret: ReturnRequest): ReturnRequest {
  if (ret.status !== RTS.PROCESSING) {
    throw new Error(`Invalid return transition: ${ret.status} -> failed`);
  }
  return Object.freeze({ ...ret, status: RTS.FAILED, updatedAt: new Date() });
}
