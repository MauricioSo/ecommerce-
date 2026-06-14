import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../shared/infrastructure/db/index.ts";
import * as s from "../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export function asDb(tx: unknown): Db {
  return tx as Db;
}

export async function findShipmentByOrderId(orderId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.shipments).where(eq(s.shipments.orderId, orderId)).orderBy(desc(s.shipments.createdAt));
  return rows[0] ?? null;
}

export async function findShipmentById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.shipments).where(eq(s.shipments.id, id));
  return rows[0] ?? null;
}

export async function findShipmentsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select().from(s.shipments).where(eq(s.shipments.orderId, orderId)).orderBy(desc(s.shipments.createdAt));
}

export async function insertShipment(input: {
  id: string;
  orderId: string;
  carrier: string | null;
  status: string;
  trackingCode?: string | null;
}, db: Db = getDb()) {
  await db.insert(s.shipments).values({
    id: input.id,
    orderId: input.orderId,
    carrier: input.carrier,
    status: input.status,
    trackingCode: input.trackingCode ?? null,
  });
}

export async function updateShipment(id: string, data: {
  status?: string;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryDate?: string;
}, db: Db = getDb()) {
  await db.update(s.shipments).set({ ...data, updatedAt: new Date() }).where(eq(s.shipments.id, id));
}

export async function findShipmentEvents(shipmentId: string, db: Db = getDb()) {
  return db.select().from(s.shipmentEvents)
    .where(eq(s.shipmentEvents.shipmentId, shipmentId))
    .orderBy(s.shipmentEvents.occurredAt);
}

export async function insertShipmentEvent(input: {
  id: string;
  shipmentId: string;
  status: string;
  title: string;
  description?: string | null;
  occurredAt: Date;
  source: string;
  rawPayload?: unknown;
}, db: Db = getDb()) {
  await db.insert(s.shipmentEvents).values({
    id: input.id,
    shipmentId: input.shipmentId,
    status: input.status,
    title: input.title,
    description: input.description ?? null,
    occurredAt: input.occurredAt,
    source: input.source,
    rawPayload: input.rawPayload ?? null,
  });
}

export async function findReturnRequestsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select().from(s.returnRequests).where(eq(s.returnRequests.orderId, orderId)).orderBy(desc(s.returnRequests.createdAt));
}

export async function findReturnRequestById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.returnRequests).where(eq(s.returnRequests.id, id));
  return rows[0] ?? null;
}

export async function insertReturnRequest(input: {
  id: string;
  orderId: string;
  orderItemId: string;
  reason: string;
  status: string;
  customerId?: string | null;
}, db: Db = getDb()) {
  await db.insert(s.returnRequests).values({
    id: input.id,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    reason: input.reason,
    status: input.status,
    customerId: input.customerId ?? null,
  });
}

export async function updateReturnRequest(id: string, data: {
  status?: string;
}, db: Db = getDb()) {
  await db.update(s.returnRequests).set({ ...data, updatedAt: new Date() }).where(eq(s.returnRequests.id, id));
}

export async function listAllReturnRequests(db: Db = getDb()) {
  return db.select().from(s.returnRequests).orderBy(desc(s.returnRequests.createdAt));
}

export async function findOrderByIdAndPublicToken(orderId: string, publicToken: string, db: Db = getDb()) {
  const [row] = await db.select().from(s.orders)
    .where(and(eq(s.orders.id, orderId), eq(s.orders.publicToken, publicToken)))
    .limit(1);
  return row ?? null;
}
