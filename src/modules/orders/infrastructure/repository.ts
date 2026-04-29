import { eq, desc, sql, and, count } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export function asDb(tx: unknown): Db {
  return tx as Db;
}

export type OrderRow = typeof s.orders.$inferSelect;
export type OrderItemRow = typeof s.orderItems.$inferSelect;

export type OrderDetailView = OrderRow & {
  items: OrderItemRow[];
  payments: Array<{
    id: string;
    provider: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: Date;
  }>;
};

export async function findOrderById(id: string, db: Db = getDb()): Promise<OrderRow | null> {
  const rows = await db.select().from(s.orders).where(eq(s.orders.id, id));
  return rows[0] ?? null;
}

export async function findOrderItemsByOrderId(orderId: string, db: Db = getDb()): Promise<OrderItemRow[]> {
  return db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
}

export async function findOrderPaymentsByOrderId(orderId: string, db: Db = getDb()) {
  return db.select({
    id: s.paymentAttempts.id,
    provider: s.paymentAttempts.provider,
    amountCents: s.paymentAttempts.amountCents,
    currency: s.paymentAttempts.currency,
    status: s.paymentAttempts.status,
    createdAt: s.paymentAttempts.createdAt,
  }).from(s.paymentAttempts).where(eq(s.paymentAttempts.orderId, orderId)).orderBy(desc(s.paymentAttempts.createdAt));
}

export async function getOrderDetail(orderId: string, db: Db = getDb()): Promise<OrderDetailView | null> {
  const order = await findOrderById(orderId, db);
  if (!order) return null;
  const items = await findOrderItemsByOrderId(orderId, db);
  const payments = await findOrderPaymentsByOrderId(orderId, db);
  return { ...order, items, payments };
}

export type OrderFilters = {
  status?: string;
  page?: number;
  limit?: number;
};

export type OrderListResult = {
  orders: OrderRow[];
  total: number;
  page: number;
  totalPages: number;
};

export async function listOrdersWithFilters(filters: OrderFilters = {}, db: Db = getDb()): Promise<OrderListResult> {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters.status) {
    conditions.push(eq(s.orders.status, filters.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ total: count() }).from(s.orders).where(where);
  const total = countResult?.total ?? 0;

  const orders = await db.select().from(s.orders)
    .where(where)
    .orderBy(desc(s.orders.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateOrderStatus(orderId: string, status: string, db: Db = getDb()): Promise<void> {
  await db.update(s.orders).set({ status, updatedAt: new Date() }).where(eq(s.orders.id, orderId));
}

export async function getOrderCountsByStatus(db: Db = getDb()): Promise<Record<string, number>> {
  const rows = await db.select({
    status: s.orders.status,
    count: count(),
  }).from(s.orders).groupBy(s.orders.status);

  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.status] = r.count;
  }
  return result;
}

export async function getRecentOrders(limit: number = 10, db: Db = getDb()): Promise<OrderRow[]> {
  return db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(limit);
}

export async function getTotalRevenue(db: Db = getDb()): Promise<number> {
  const [row] = await db.select({
    total: sql<number>`coalesce(sum(${s.orders.totalCents}), 0)`,
  }).from(s.orders).where(sql`${s.orders.status} not in ('cancelled')`);
  return row?.total ?? 0;
}

export async function insertAuditEvent(input: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  actorId: string | null;
  correlationId: string | null;
}, db: Db = getDb()): Promise<void> {
  await db.insert(s.auditEvents).values({
    id: crypto.randomUUID(),
    ...input,
  });
}
