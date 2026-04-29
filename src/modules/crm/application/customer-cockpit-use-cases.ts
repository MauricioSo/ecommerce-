import { inArray } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";
import * as repo from "../infrastructure/repository.ts";
import type { CustomerCockpit, CrmCustomerListItem, CrmTask } from "../domain/entities.ts";
import type { CrmTaskType, CrmTaskStatus, CrmTaskPriority, CrmCustomerStatus } from "../domain/types.ts";
import { VALID_CUSTOMER_STATUSES } from "../domain/types.ts";

type Db = ReturnType<typeof getDb>;

const SENSITIVE_AUDIT_FIELDS = new Set(["passwordHash", "tokenHash", "secret", "apiKey", "providerIntentId", "metadata", "rawPayload"]);

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (!SENSITIVE_AUDIT_FIELDS.has(k)) safe[k] = v;
  }
  return safe;
}

export async function listCrmCustomersUseCase(filters: {
  query?: string;
  tagId?: string;
  status?: string;
  hasOpenTasks?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{
  customers: CrmCustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const db = getDb();
  const result = await repo.searchCustomers(filters, db);

  const customersWithMeta: CrmCustomerListItem[] = await Promise.all(
    result.customers.map(async (c) => {
      const profile = await repo.findCustomerCrmProfile(c.id, db);
      const orderSummary = await repo.getCustomerOrderSummary(c.id, db);
      const tags = await repo.findCustomerTags(c.id, db);
      const openTasksCount = await repo.getOpenTasksCount(c.id, db);

      return {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        countryCode: c.countryCode,
        crmStatus: (profile?.status as CrmCustomerListItem["crmStatus"]) ?? "new",
        totalOrders: orderSummary.totalOrders,
        totalSpentCents: orderSummary.totalSpentCents,
        lastOrderDate: orderSummary.lastOrderDate,
        tags: tags.map((t) => ({
          id: t.tag.id,
          name: t.tag.name,
          color: t.tag.color,
        })),
        openTasksCount,
      };
    })
  );

  return {
    customers: customersWithMeta,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

export async function getCustomerCockpitUseCase(customerId: string): Promise<CustomerCockpit | null> {
  const db = getDb();

  const customer = await repo.findCustomerById(customerId, db);
  if (!customer) return null;

  const profile = await repo.findCustomerCrmProfile(customerId, db);
  const addresses = await repo.findCustomerAddresses(customerId, db);
  const orderSummary = await repo.getCustomerOrderSummary(customerId, db);
  const recentOrders = await repo.findCustomerOrders(customerId, db);
  const recentPayments = await repo.findCustomerPayments(customerId, db);
  const activeShipments = await repo.findCustomerShipments(customerId, db);
  const activeReturns = await repo.findCustomerReturns(customerId, db);
  const notes = await repo.findCustomerNotes(customerId, db);
  const tags = await repo.findCustomerTags(customerId, db);
  const openTasks = await repo.findCustomerTasks(customerId, db);
  const interactions = await repo.findCustomerInteractions(customerId, db);

  const timeline = await buildTimeline(customerId, db);

  const castProfile = profile ? {
    ...profile,
    status: profile.status as CustomerCockpit["profile"] extends null ? never : NonNullable<CustomerCockpit["profile"]>["status"],
  } : null;

  return {
    profile: castProfile,
    customer: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      countryCode: customer.countryCode,
      createdAt: customer.createdAt,
    },
    addresses: addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      phone: a.phone,
      isDefault: a.isDefault,
    })),
    summary: {
      totalOrders: orderSummary.totalOrders,
      totalSpentCents: orderSummary.totalSpentCents,
      averageOrderValueCents: orderSummary.averageOrderValueCents,
      lastOrderDate: orderSummary.lastOrderDate,
    },
    recentOrders: recentOrders.slice(0, 10).map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
    })),
    recentPayments: recentPayments.slice(0, 10).map((p) => ({
      id: p.id,
      status: p.status,
      amountCents: p.amountCents,
      createdAt: p.createdAt,
    })),
    activeShipments: activeShipments.filter((sh) => !["delivered", "cancelled"].includes(sh.status)),
    activeReturns: activeReturns.filter((r) => !["approved", "rejected"].includes(r.status)),
    notes: notes.map((n) => ({
      id: n.id,
      customerId: n.customerId,
      authorAdminId: n.authorAdminId,
      body: n.body,
      visibility: n.visibility as "internal" | "public",
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    tags: tags.map((t) => ({
      customerId: t.customerId,
      tagId: t.tagId,
      tag: {
        id: t.tag.id,
        name: t.tag.name,
        color: t.tag.color,
        description: t.tag.description,
        createdAt: t.tag.createdAt,
      },
      assignedBy: t.assignedBy,
      assignedAt: t.assignedAt,
    })),
    openTasks: openTasks
      .filter((t) => t.status === "open" || t.status === "in_progress")
      .map((t) => ({
        id: t.id,
        customerId: t.customerId,
        orderId: t.orderId,
        assignedTo: t.assignedTo,
        createdBy: t.createdBy,
        type: t.type as CrmTaskType,
        status: t.status as CrmTaskStatus,
        priority: t.priority as CrmTaskPriority,
        title: t.title,
        description: t.description,
        dueAt: t.dueAt,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })) as CrmTask[],
    interactions: interactions.slice(0, 20).map((i) => ({
      id: i.id,
      customerId: i.customerId,
      orderId: i.orderId,
      adminId: i.adminId,
      channel: i.channel as "phone" | "email" | "whatsapp" | "internal" | "other",
      direction: i.direction as "inbound" | "outbound" | "internal",
      summary: i.summary,
      createdAt: i.createdAt,
    })),
    timeline,
  };
}

async function buildTimeline(customerId: string, db: Db) {
  const timeline: Array<{ type: string; date: Date; data: Record<string, unknown> }> = [];

  const orders = await repo.findCustomerOrders(customerId, db);
  for (const o of orders) {
    timeline.push({ type: "order_created", date: o.createdAt, data: { orderId: o.id, status: o.status, totalCents: o.totalCents } });
  }

  const payments = await repo.findCustomerPayments(customerId, db);
  for (const p of payments) {
    timeline.push({ type: "payment_attempt", date: p.createdAt, data: { paymentId: p.id, status: p.status, amountCents: p.amountCents } });
  }

  const shipments = await repo.findCustomerShipments(customerId, db);
  for (const sh of shipments) {
    timeline.push({ type: "shipment", date: new Date(0), data: { shipmentId: sh.id, status: sh.status, carrier: sh.carrier, trackingCode: sh.trackingCode } });
  }

  const returns = await repo.findCustomerReturns(customerId, db);
  for (const r of returns) {
    timeline.push({ type: "return_request", date: r.createdAt, data: { returnId: r.id, status: r.status, reason: r.reason } });
  }

  const notes = await repo.findCustomerNotes(customerId, db);
  for (const n of notes) {
    timeline.push({ type: "crm_note_added", date: n.createdAt, data: { noteId: n.id, visibility: n.visibility } });
  }

  const tasks = await repo.findCustomerTasks(customerId, db);
  for (const t of tasks) {
    timeline.push({ type: "crm_task_created", date: t.createdAt, data: { taskId: t.id, type: t.type, title: t.title, priority: t.priority, status: t.status } });
    if (t.completedAt) {
      timeline.push({ type: "crm_task_completed", date: t.completedAt, data: { taskId: t.id, type: t.type, title: t.title } });
    }
  }

  const interactions = await repo.findCustomerInteractions(customerId, db);
  for (const i of interactions) {
    timeline.push({ type: "crm_interaction_added", date: i.createdAt, data: { interactionId: i.id, channel: i.channel, direction: i.direction, summary: i.summary } });
  }

  const orderIds = orders.map((o) => o.id);
  const taskIds = tasks.map((t) => t.id);
  const allAuditAggregateIds = [customerId, ...orderIds, ...taskIds];

  if (allAuditAggregateIds.length > 0) {
    const auditRows = await db.select().from(s.auditEvents)
      .where(inArray(s.auditEvents.aggregateId, allAuditAggregateIds));

    const seenEventKeys = new Set<string>();
    for (const t of timeline) {
      seenEventKeys.add(`${t.type}:${t.date.getTime()}`);
    }

    for (const evt of auditRows) {
      const key = `${evt.eventType}:${evt.createdAt.getTime()}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        timeline.push({
          type: evt.eventType,
          date: evt.createdAt,
          data: sanitizePayload(evt.payload),
        });
      }
    }
  }

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  return timeline.slice(0, 50);
}

export async function updateCrmCustomerStatusUseCase(customerId: string, status: string, actorId?: string): Promise<void> {
  if (!VALID_CUSTOMER_STATUSES.includes(status as CrmCustomerStatus)) {
    throw new Error(`Invalid CRM status: ${status}. Valid: ${VALID_CUSTOMER_STATUSES.join(", ")}`);
  }

  const db = getDb();

  const profile = await repo.upsertCrmCustomerProfile(customerId, db);
  const previousStatus = profile!.status;

  if (previousStatus === status) return;

  await db.transaction(async (tx) => {
    await repo.updateCrmCustomerProfile(customerId, { status }, tx as unknown as Db);

    await tx.insert(s.auditEvents).values({
      id: crypto.randomUUID(),
      aggregateType: "customer",
      aggregateId: customerId,
      eventType: "crm_customer_status_changed",
      payload: { from: previousStatus, to: status },
      actorId: actorId ?? null,
      correlationId: null,
    });
  });
}
