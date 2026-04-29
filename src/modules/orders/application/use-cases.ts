import { and, eq } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";
import {
  type OrderStatus,
  canTransitionTo,
  ORDER_TRANSITIONS,
} from "../domain/types.ts";

export type { OrderDetailView, OrderListResult, OrderRow, OrderItemRow } from "../infrastructure/repository.ts";

export async function getOrderDetailUseCase(orderId: string) {
  const detail = await repo.getOrderDetail(orderId);
  if (!detail) throw new Error("Order not found");

  const validTransitions = ORDER_TRANSITIONS[detail.status as OrderStatus] ?? [];
  return { ...detail, validTransitions };
}

export async function listOrdersUseCase(filters?: { status?: string; page?: number }) {
  return repo.listOrdersWithFilters(filters);
}

export async function transitionOrderStatusUseCase(input: {
  orderId: string;
  targetStatus: OrderStatus;
  reason?: string;
  actorId?: string;
}): Promise<void> {
  const db = getDb();
  const order = await repo.findOrderById(input.orderId);
  if (!order) throw new Error("Order not found");

  if (!canTransitionTo(order.status as OrderStatus, input.targetStatus)) {
    throw new Error(`Invalid transition: ${order.status} -> ${input.targetStatus}`);
  }

  await db.transaction(async (tx) => {
    const t = repo.asDb(tx);
    await repo.updateOrderStatus(input.orderId, input.targetStatus, t);
    await repo.insertAuditEvent({
      aggregateType: "order",
      aggregateId: input.orderId,
      eventType: `status_changed_to_${input.targetStatus}`,
      payload: {
        from: order.status,
        to: input.targetStatus,
        reason: input.reason ?? null,
      },
      actorId: input.actorId ?? null,
      correlationId: null,
    }, t);
  });
}

export async function getOrderTimelineUseCase(orderId: string) {
  const db = getDb();
  return db.select().from(s.auditEvents)
    .where(and(eq(s.auditEvents.aggregateType, "order"), eq(s.auditEvents.aggregateId, orderId)))
    .orderBy(s.auditEvents.createdAt);
}

export async function getDashboardDataUseCase() {
  const [counts, recentOrders, totalRevenue] = await Promise.all([
    repo.getOrderCountsByStatus(),
    repo.getRecentOrders(10),
    repo.getTotalRevenue(),
  ]);

  const allStatuses: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
  const statusCounts: Record<string, number> = {};
  for (const st of allStatuses) {
    statusCounts[st] = counts[st] ?? 0;
  }

  return {
    statusCounts,
    recentOrders,
    totalRevenue,
    totalOrders: Object.values(statusCounts).reduce((a, b) => a + b, 0),
  };
}
