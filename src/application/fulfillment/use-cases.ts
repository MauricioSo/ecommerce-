import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import * as repo from "../../infrastructure/fulfillment/repository.ts";
import {
  createShipment,
  createReturnRequest,
  approveReturn,
  rejectReturn,
  pickupShipment,
  markInTransit,
  markOutForDelivery,
  deliverShipment,
  cancelShipment,
  setTrackingCode,
  type Shipment,
  type ReturnRequest,
} from "../../domain/fulfillment/entities.ts";
import { type ShipmentStatus, type ReturnStatus } from "../../domain/fulfillment/types.ts";
import { emitEventWithDb } from "../../shared/infrastructure/outbox/worker.ts";
import { eq, and } from "drizzle-orm";

export async function createShipmentUseCase(input: { orderId: string; carrier?: string }) {
  const order = await getDb().select().from(s.orders).where(eq(s.orders.id, input.orderId));
  if (!order[0]) throw new Error("Order not found");
  const validStatuses = ["confirmed", "processing", "shipped"];
  if (!validStatuses.includes(order[0].status)) {
    throw new Error(`Cannot create shipment for order in status: ${order[0].status}`);
  }
  const shipment = createShipment(input);
  await getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.insertShipment({
      id: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      status: shipment.status,
    }, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "shipment",
      aggregateId: shipment.id,
      eventType: "shipment_created",
      payload: { orderId: shipment.orderId, carrier: shipment.carrier },
      actorId: null,
      correlationId: null,
    });
    await emitEventWithDb(tx, {
      aggregateType: "shipment",
      aggregateId: shipment.id,
      eventType: "shipment_created",
      payload: { orderId: shipment.orderId, customerEmail: order[0]?.customerEmail ?? null, shipmentStatus: shipment.status },
    });
  });
  return shipment;
}

export async function updateShipmentStatusUseCase(shipmentId: string, targetStatus: ShipmentStatus) {
  const db = getDb();
  const existing = await repo.findShipmentById(shipmentId);
  if (!existing) throw new Error("Shipment not found");
  const shipment: Shipment = {
    ...existing,
    trackingCode: existing.trackingCode,
    carrier: existing.carrier,
    status: existing.status as ShipmentStatus,
  };
  const updated = targetStatus === "picked_up"
    ? pickupShipment(shipment)
    : targetStatus === "in_transit"
      ? markInTransit(shipment)
      : targetStatus === "out_for_delivery"
        ? markOutForDelivery(shipment)
        : targetStatus === "delivered"
          ? deliverShipment(shipment)
          : targetStatus === "cancelled"
            ? cancelShipment(shipment)
            : (() => { throw new Error(`Unsupported shipment target status: ${targetStatus}`); })();
  await db.transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.updateShipment(shipmentId, {
      status: updated.status,
      shippedAt: updated.shippedAt ?? undefined,
      deliveredAt: updated.deliveredAt ?? undefined,
    }, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "shipment",
      aggregateId: shipmentId,
      eventType: `shipment_status_changed_to_${targetStatus}`,
      payload: { from: existing.status, to: targetStatus },
      actorId: null,
      correlationId: null,
    });
    const order = await tx.select().from(s.orders).where(eq(s.orders.id, existing.orderId));
    await emitEventWithDb(tx, {
      aggregateType: "shipment",
      aggregateId: shipmentId,
      eventType: "shipment_status_changed",
      payload: {
        orderId: existing.orderId,
        customerEmail: order[0]?.customerEmail ?? null,
        shipmentStatus: targetStatus,
      },
    });
  });
}

export async function setTrackingCodeUseCase(shipmentId: string, trackingCode: string) {
  const existing = await repo.findShipmentById(shipmentId);
  if (!existing) throw new Error("Shipment not found");
  const updated = setTrackingCode({
    ...existing,
    trackingCode: existing.trackingCode,
    carrier: existing.carrier,
    status: existing.status as ShipmentStatus,
  }, trackingCode);
  await repo.updateShipment(shipmentId, { trackingCode: updated.trackingCode ?? undefined });
}

export async function getOrderShipment(orderId: string) {
  return repo.findShipmentByOrderId(orderId);
}

export async function createReturnRequestUseCase(input: {
  orderId: string;
  orderItemId: string;
  reason: string;
  customerId?: string;
}) {
  const matchingItems = await getDb().select().from(s.orderItems)
    .where(and(eq(s.orderItems.id, input.orderItemId), eq(s.orderItems.orderId, input.orderId)));
  if (matchingItems.length === 0) throw new Error("Order item does not belong to order");
  const ret = createReturnRequest(input);
  await getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.insertReturnRequest({
      id: ret.id,
      orderId: ret.orderId,
      orderItemId: ret.orderItemId,
      reason: ret.reason,
      status: ret.status,
      customerId: ret.customerId,
    }, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "return",
      aggregateId: ret.id,
      eventType: "return_requested",
      payload: { orderId: ret.orderId, orderItemId: ret.orderItemId, reason: ret.reason },
      actorId: null,
      correlationId: null,
    });
    const order = await tx.select().from(s.orders).where(eq(s.orders.id, ret.orderId));
    await emitEventWithDb(tx, {
      aggregateType: "return",
      aggregateId: ret.id,
      eventType: "return_requested",
      payload: { orderId: ret.orderId, customerEmail: order[0]?.customerEmail ?? null },
    });
  });
  return ret;
}

export async function approveReturnUseCase(returnId: string) {
  const row = await repo.findReturnRequestById(returnId);
  if (!row) throw new Error("Return request not found");
  const ret: ReturnRequest = { ...row, customerId: row.customerId, status: row.status as ReturnStatus };
  const approved = approveReturn(ret);
  await getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.updateReturnRequest(returnId, { status: approved.status }, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "return",
      aggregateId: returnId,
      eventType: "return_approved",
      payload: { orderId: ret.orderId },
      actorId: null,
      correlationId: null,
    });
    const order = await tx.select().from(s.orders).where(eq(s.orders.id, ret.orderId));
    await emitEventWithDb(tx, {
      aggregateType: "return",
      aggregateId: returnId,
      eventType: "return_approved",
      payload: { orderId: ret.orderId, customerEmail: order[0]?.customerEmail ?? null },
    });
  });
}

export async function rejectReturnUseCase(returnId: string) {
  const row = await repo.findReturnRequestById(returnId);
  if (!row) throw new Error("Return request not found");
  const ret: ReturnRequest = { ...row, customerId: row.customerId, status: row.status as ReturnStatus };
  const rejected = rejectReturn(ret);
  await getDb().transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.updateReturnRequest(returnId, { status: rejected.status }, t);
    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "return",
      aggregateId: returnId,
      eventType: "return_rejected",
      payload: { orderId: ret.orderId },
      actorId: null,
      correlationId: null,
    });
  });
}

export async function getOrderReturns(orderId: string) {
  return repo.findReturnRequestsByOrderId(orderId);
}

export async function listAllReturns() {
  return repo.listAllReturnRequests();
}

export async function getShipmentEvents(shipmentId: string) {
  return repo.findShipmentEvents(shipmentId);
}
