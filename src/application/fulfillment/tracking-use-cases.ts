import { eq } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";
import * as repo from "../../infrastructure/fulfillment/repository.ts";
import type { ShipmentStatus } from "../../domain/fulfillment/types.ts";
import {
  type Shipment,
  createShipment,
  pickupShipment,
  markInTransit,
  markOutForDelivery,
  deliverShipment,
  cancelShipment,
} from "../../domain/fulfillment/entities.ts";
import { canTransitionTo } from "../../domain/fulfillment/types.ts";
import { emitEventWithDb } from "../../shared/infrastructure/outbox/worker.ts";

export type PublicTrackingInfo = {
  orderId: string;
  orderPublicToken: string;
  orderStatus: string;
  orderStatusLabel: string;
  createdAt: Date;
  items: Array<{
    productName: string;
    variantLabel: string | null;
    quantity: number;
  }>;
  shipment: {
    status: ShipmentStatus;
    statusLabel: string;
    carrier: string | null;
    trackingCode: string | null;
    trackingUrl: string | null;
    estimatedDeliveryDate: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    timeline: Array<{
      status: string;
      statusLabel: string;
      title: string;
      description: string | null;
      occurredAt: Date;
    }>;
  } | null;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  confirmed: "Pago confirmado",
  processing: "Preparando pedido",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En preparación",
  picked_up: "Retirado por transportista",
  in_transit: "En camino",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function getShipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABELS[status] ?? status;
}

export async function getPublicOrderTrackingUseCase(publicToken: string): Promise<PublicTrackingInfo | null> {
  const db = getDb();
  const orders = await db.select().from(s.orders).where(eq(s.orders.publicToken, publicToken));
  const order = orders[0];
  if (!order) return null;

  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));

  const shipment = await repo.findShipmentByOrderId(order.id);
  let timeline: Array<{ status: string; statusLabel: string; title: string; description: string | null; occurredAt: Date }> = [];

  if (shipment) {
    const events = await repo.findShipmentEvents(shipment.id);
    timeline = events.map((e) => ({
      status: e.status,
      statusLabel: getShipmentStatusLabel(e.status),
      title: e.title,
      description: e.description ?? null,
      occurredAt: e.occurredAt,
    }));
  }

  return {
    orderId: order.id,
    orderPublicToken: order.publicToken,
    orderStatus: order.status,
    orderStatusLabel: getOrderStatusLabel(order.status),
    createdAt: order.createdAt,
    items: items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel ?? null,
      quantity: i.quantity,
    })),
    shipment: shipment
      ? {
          status: shipment.status as ShipmentStatus,
          statusLabel: getShipmentStatusLabel(shipment.status),
          carrier: shipment.carrier,
          trackingCode: shipment.trackingCode,
          trackingUrl: shipment.trackingUrl,
          estimatedDeliveryDate: shipment.estimatedDeliveryDate?.toString() ?? null,
          shippedAt: shipment.shippedAt ?? null,
          deliveredAt: shipment.deliveredAt ?? null,
          timeline,
        }
      : null,
  };
}

type ShipmentUpdateData = {
  status?: string;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryDate?: string;
};

export async function updateShipmentTrackingUseCase(input: {
  shipmentId: string;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDeliveryDate?: Date;
}): Promise<void> {
  const db = getDb();
  const existing = await repo.findShipmentById(input.shipmentId);
  if (!existing) throw new Error("Shipment not found");

  const updateData: ShipmentUpdateData = {};
  if (input.trackingCode !== undefined) updateData.trackingCode = input.trackingCode;
  if (input.trackingUrl !== undefined) updateData.trackingUrl = input.trackingUrl;
  if (input.carrier !== undefined) updateData.carrier = input.carrier;
  if (input.estimatedDeliveryDate !== undefined) {
    updateData.estimatedDeliveryDate = input.estimatedDeliveryDate.toISOString().split("T")[0];
  }

  await db.transaction(async (tx) => {
    if (Object.keys(updateData).length > 0) {
      await tx.update(s.shipments).set({ ...updateData, updatedAt: new Date() }).where(eq(s.shipments.id, input.shipmentId));
    }

    if (input.trackingCode && input.trackingCode !== existing.trackingCode) {
      await repo.insertShipmentEvent({
        id: crypto.randomUUID(),
        shipmentId: input.shipmentId,
        status: existing.status,
        title: "Tracking agregado",
        description: `Número de seguimiento: ${input.trackingCode}`,
        occurredAt: new Date(),
        source: "admin",
      });

      await tx.insert(s.auditEvents).values({
        id: crypto.randomUUID(),
        aggregateType: "shipment",
        aggregateId: input.shipmentId,
        eventType: "shipment_tracking_updated",
        payload: { trackingCode: input.trackingCode, carrier: input.carrier },
        actorId: null,
        correlationId: null,
      });

      await emitEventWithDb(tx, {
        aggregateType: "shipment",
        aggregateId: input.shipmentId,
        eventType: "shipment_tracking_added",
        payload: { trackingCode: input.trackingCode, carrier: input.carrier },
      });
    }
  });
}

export async function updateShipmentStatusUseCase(shipmentId: string, targetStatus: ShipmentStatus): Promise<void> {
  const db = getDb();
  const existing = await repo.findShipmentById(shipmentId);
  if (!existing) throw new Error("Shipment not found");

  const currentStatus = existing.status as ShipmentStatus;
  if (!canTransitionTo(currentStatus, targetStatus)) {
    throw new Error(`Invalid shipment transition: ${currentStatus} -> ${targetStatus}`);
  }

  let updated: Shipment = {
    ...existing,
    status: currentStatus,
  } as Shipment;

  switch (targetStatus) {
    case "picked_up":
      updated = pickupShipment(updated);
      break;
    case "in_transit":
      updated = markInTransit(updated);
      break;
    case "out_for_delivery":
      updated = markOutForDelivery(updated);
      break;
    case "delivered":
      updated = deliverShipment(updated);
      break;
    case "cancelled":
      updated = cancelShipment(updated);
      break;
    default:
      throw new Error(`Unsupported target status: ${targetStatus}`);
  }

  const title = getShipmentStatusLabel(targetStatus);

  await db.transaction(async (tx) => {
    const updateData: ShipmentUpdateData = {
      status: updated.status,
    };
    if (updated.shippedAt) updateData.shippedAt = updated.shippedAt;
    if (updated.deliveredAt) updateData.deliveredAt = updated.deliveredAt;

    await tx.update(s.shipments).set({ ...updateData, updatedAt: new Date() }).where(eq(s.shipments.id, shipmentId));

    await repo.insertShipmentEvent({
      id: crypto.randomUUID(),
      shipmentId,
      status: targetStatus,
      title,
      description: null,
      occurredAt: new Date(),
      source: "admin",
    });

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "shipment",
      aggregateId: shipmentId,
      eventType: `shipment_status_changed_to_${targetStatus}`,
      payload: { from: currentStatus, to: targetStatus },
      actorId: null,
      correlationId: null,
    });

    if (targetStatus === "picked_up" || targetStatus === "delivered") {
      const orderStatus = targetStatus === "delivered" ? "delivered" : "shipped";
      await tx.update(s.orders).set({ status: orderStatus, updatedAt: new Date() }).where(eq(s.orders.id, existing.orderId));
    }

    const order = await tx.select().from(s.orders).where(eq(s.orders.id, existing.orderId));

    await emitEventWithDb(tx, {
      aggregateType: "shipment",
      aggregateId: shipmentId,
      eventType: `shipment_status_changed`,
      payload: {
        orderId: existing.orderId,
        customerEmail: order[0]?.customerEmail ?? null,
        shipmentStatus: targetStatus,
        trackingCode: existing.trackingCode,
        carrier: existing.carrier,
      },
    });
  });
}

export async function createShipmentWithEventUseCase(input: {
  orderId: string;
  carrier?: string;
}): Promise<Shipment> {
  const db = getDb();
  const order = await db.select().from(s.orders).where(eq(s.orders.id, input.orderId));
  if (!order[0]) throw new Error("Order not found");

  const validStatuses = ["pending", "confirmed", "processing", "shipped"];
  if (!validStatuses.includes(order[0].status)) {
    throw new Error(`Cannot create shipment for order in status: ${order[0].status}`);
  }

  const existingShipment = await repo.findShipmentByOrderId(input.orderId);
  if (existingShipment && existingShipment.status !== "cancelled") {
    throw new Error("Active shipment already exists for this order");
  }

  const shipment = createShipment({ orderId: input.orderId, carrier: input.carrier });

  await db.transaction(async (tx) => {
    await repo.insertShipment({
      id: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      status: shipment.status,
    });

    await repo.insertShipmentEvent({
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      status: shipment.status,
      title: "Envío creado",
      description: shipment.carrier ? `Carrier: ${shipment.carrier}` : null,
      occurredAt: new Date(),
      source: "admin",
    });

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
      payload: { orderId: shipment.orderId, customerEmail: order[0]?.customerEmail ?? null },
    });
  });

  return shipment;
}
