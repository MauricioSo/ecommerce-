import { eq, desc, and, count, sql, like, or } from "drizzle-orm";
import { getDb } from "../../../shared/infrastructure/db/index.ts";
import * as s from "../../../shared/infrastructure/db/schema.ts";

type Db = ReturnType<typeof getDb>;

export function asDb(tx: unknown): Db {
  return tx as Db;
}

export async function findCustomerById(id: string, db: Db = getDb()) {
  const rows = await db.select().from(s.customers).where(eq(s.customers.id, id));
  return rows[0] ?? null;
}

export async function findCustomerAddresses(customerId: string, db: Db = getDb()) {
  return db.select({
    id: s.addresses.id,
    label: s.addresses.label,
    line1: s.addresses.line1,
    line2: s.addresses.line2,
    city: s.addresses.city,
    state: s.addresses.state,
    postalCode: s.addresses.postalCode,
    country: s.addresses.country,
    phone: s.addresses.phone,
    isDefault: s.addresses.isDefault,
  }).from(s.addresses).where(eq(s.addresses.customerId, customerId));
}

export async function findCustomerOrders(customerId: string, db: Db = getDb()) {
  return db.select({
    id: s.orders.id,
    status: s.orders.status,
    totalCents: s.orders.totalCents,
    createdAt: s.orders.createdAt,
  }).from(s.orders).where(eq(s.orders.customerId, customerId)).orderBy(desc(s.orders.createdAt));
}

export async function findCustomerPayments(customerId: string, db: Db = getDb()) {
  return db.select({
    id: s.paymentAttempts.id,
    status: s.paymentAttempts.status,
    amountCents: s.paymentAttempts.amountCents,
    createdAt: s.paymentAttempts.createdAt,
  }).from(s.paymentAttempts)
    .innerJoin(s.orders, eq(s.paymentAttempts.orderId, s.orders.id))
    .where(eq(s.orders.customerId, customerId))
    .orderBy(desc(s.paymentAttempts.createdAt));
}

export async function findCustomerShipments(customerId: string, db: Db = getDb()) {
  return db.select({
    id: s.shipments.id,
    status: s.shipments.status,
    carrier: s.shipments.carrier,
    trackingCode: s.shipments.trackingCode,
  }).from(s.shipments)
    .innerJoin(s.orders, eq(s.shipments.orderId, s.orders.id))
    .where(eq(s.orders.customerId, customerId));
}

export async function findCustomerReturns(customerId: string, db: Db = getDb()) {
  return db.select({
    id: s.returnRequests.id,
    status: s.returnRequests.status,
    reason: s.returnRequests.reason,
    createdAt: s.returnRequests.createdAt,
  }).from(s.returnRequests).where(eq(s.returnRequests.customerId, customerId));
}

export async function findCustomerCrmProfile(customerId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.crmCustomerProfiles).where(eq(s.crmCustomerProfiles.customerId, customerId));
  return rows[0] ?? null;
}

export async function upsertCrmCustomerProfile(customerId: string, db: Db = getDb()) {
  const existing = await findCustomerCrmProfile(customerId, db);
  if (existing) return existing;

  const [created] = await db.insert(s.crmCustomerProfiles).values({
    customerId,
    status: "active",
  }).returning();
  return created;
}

export async function updateCrmCustomerProfile(customerId: string, data: {
  status?: string;
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  internalSummary?: string;
}, db: Db = getDb()) {
  await db.update(s.crmCustomerProfiles).set({ ...data, updatedAt: new Date() }).where(eq(s.crmCustomerProfiles.customerId, customerId));
}

export async function findCustomerNotes(customerId: string, db: Db = getDb()) {
  return db.select().from(s.crmCustomerNotes)
    .where(eq(s.crmCustomerNotes.customerId, customerId))
    .orderBy(desc(s.crmCustomerNotes.createdAt));
}

export async function insertCustomerNote(data: {
  customerId: string;
  authorAdminId?: string;
  body: string;
  visibility?: string;
}, db: Db = getDb()) {
  const [created] = await db.insert(s.crmCustomerNotes).values({
    customerId: data.customerId,
    authorAdminId: data.authorAdminId ?? null,
    body: data.body,
    visibility: data.visibility ?? "internal",
  }).returning();
  return created;
}

export async function updateCustomerNote(noteId: string, data: {
  body?: string;
  visibility?: string;
}, db: Db = getDb()) {
  await db.update(s.crmCustomerNotes).set({ ...data, updatedAt: new Date() }).where(eq(s.crmCustomerNotes.id, noteId));
}

export async function findCustomerNoteById(noteId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.crmCustomerNotes).where(eq(s.crmCustomerNotes.id, noteId));
  return rows[0] ?? null;
}

export async function findAllCrmTags(db: Db = getDb()) {
  return db.select().from(s.crmTags).orderBy(s.crmTags.name);
}

export async function findCrmTagById(tagId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.crmTags).where(eq(s.crmTags.id, tagId));
  return rows[0] ?? null;
}

export async function findCrmTagByName(name: string, db: Db = getDb()) {
  const rows = await db.select().from(s.crmTags).where(eq(s.crmTags.name, name));
  return rows[0] ?? null;
}

export async function insertCrmTag(data: {
  name: string;
  color?: string;
  description?: string;
}, db: Db = getDb()) {
  const [created] = await db.insert(s.crmTags).values(data).returning();
  return created;
}

export async function findCustomerTags(customerId: string, db: Db = getDb()) {
  return db.select({
    customerId: s.crmCustomerTags.customerId,
    tagId: s.crmCustomerTags.tagId,
    tag: s.crmTags,
    assignedBy: s.crmCustomerTags.assignedBy,
    assignedAt: s.crmCustomerTags.assignedAt,
  })
    .from(s.crmCustomerTags)
    .innerJoin(s.crmTags, eq(s.crmCustomerTags.tagId, s.crmTags.id))
    .where(eq(s.crmCustomerTags.customerId, customerId));
}

export async function assignCrmTagToCustomer(data: {
  customerId: string;
  tagId: string;
  assignedBy?: string;
}, db: Db = getDb()) {
  try {
    const [created] = await db.insert(s.crmCustomerTags).values({
      customerId: data.customerId,
      tagId: data.tagId,
      assignedBy: data.assignedBy ?? null,
    }).returning();
    return created;
  } catch {
    return null;
  }
}

export async function removeCrmTagFromCustomer(customerId: string, tagId: string, db: Db = getDb()) {
  await db.delete(s.crmCustomerTags).where(and(
    eq(s.crmCustomerTags.customerId, customerId),
    eq(s.crmCustomerTags.tagId, tagId)
  ));
}

export async function findCustomerTasks(customerId: string, db: Db = getDb()) {
  return db.select().from(s.crmTasks)
    .where(eq(s.crmTasks.customerId, customerId))
    .orderBy(desc(s.crmTasks.createdAt));
}

export async function findOpenTasks(db: Db = getDb()) {
  return db.select().from(s.crmTasks)
    .where(or(
      eq(s.crmTasks.status, "open"),
      eq(s.crmTasks.status, "in_progress")
    ))
    .orderBy(desc(s.crmTasks.createdAt));
}

export async function findTaskById(taskId: string, db: Db = getDb()) {
  const rows = await db.select().from(s.crmTasks).where(eq(s.crmTasks.id, taskId));
  return rows[0] ?? null;
}

export async function insertCrmTask(data: {
  customerId?: string;
  orderId?: string;
  assignedTo?: string;
  createdBy?: string;
  type: string;
  title: string;
  description?: string;
  priority?: string;
  dueAt?: Date;
}, db: Db = getDb()) {
  const [created] = await db.insert(s.crmTasks).values({
    customerId: data.customerId ?? null,
    orderId: data.orderId ?? null,
    assignedTo: data.assignedTo ?? null,
    createdBy: data.createdBy ?? null,
    type: data.type,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority ?? "normal",
    status: "open",
    dueAt: data.dueAt ?? null,
  }).returning();
  return created;
}

export async function updateCrmTaskStatus(taskId: string, status: string, db: Db = getDb()) {
  const completedAt = status === "done" ? new Date() : null;
  await db.update(s.crmTasks).set({ status, completedAt, updatedAt: new Date() }).where(eq(s.crmTasks.id, taskId));
}

export async function findCustomerInteractions(customerId: string, db: Db = getDb()) {
  return db.select().from(s.crmInteractions)
    .where(eq(s.crmInteractions.customerId, customerId))
    .orderBy(desc(s.crmInteractions.createdAt));
}

export async function insertCrmInteraction(data: {
  customerId: string;
  orderId?: string;
  adminId?: string;
  channel: string;
  direction?: string;
  summary: string;
}, db: Db = getDb()) {
  const [created] = await db.insert(s.crmInteractions).values({
    customerId: data.customerId,
    orderId: data.orderId ?? null,
    adminId: data.adminId ?? null,
    channel: data.channel,
    direction: data.direction ?? "internal",
    summary: data.summary,
  }).returning();
  return created;
}

export type CustomerSearchFilters = {
  query?: string;
  tagId?: string;
  status?: string;
  hasOpenTasks?: boolean;
  page?: number;
  pageSize?: number;
};

function buildSearchConditions(filters: CustomerSearchFilters) {
  const conditions = [];

  if (filters.query) {
    const q = `%${filters.query}%`;
    conditions.push(or(
      like(s.customers.email, q),
      like(s.customers.firstName, q),
      like(s.customers.lastName, q),
      like(s.customers.phone, q),
      like(s.customers.documentNumber, q)
    ));
  }

  if (filters.status) {
    conditions.push(sql`${s.customers.id} IN (SELECT customer_id FROM crm_customer_profiles WHERE status = ${filters.status})`);
  }

  if (filters.tagId) {
    conditions.push(sql`${s.customers.id} IN (SELECT customer_id FROM crm_customer_tags WHERE tag_id = ${filters.tagId})`);
  }

  if (filters.hasOpenTasks) {
    conditions.push(sql`${s.customers.id} IN (SELECT customer_id FROM crm_tasks WHERE status IN ('open', 'in_progress'))`);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function searchCustomers(filters: CustomerSearchFilters, db: Db = getDb()) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const whereClause = buildSearchConditions(filters);

  const customers = await db.select({
    id: s.customers.id,
    email: s.customers.email,
    firstName: s.customers.firstName,
    lastName: s.customers.lastName,
    phone: s.customers.phone,
    countryCode: s.customers.countryCode,
  }).from(s.customers)
    .where(whereClause)
    .limit(pageSize).offset(offset).orderBy(desc(s.customers.createdAt));

  const countResult = await db.select({ count: count() }).from(s.customers).where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  return {
    customers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCustomerOrderSummary(customerId: string, db: Db = getDb()) {
  const result = await db.select({
    totalOrders: count(s.orders.id),
    totalSpentCents: sql<number>`COALESCE(SUM(${s.orders.totalCents}), 0)`,
    lastOrderDate: sql<Date>`MAX(${s.orders.createdAt})`,
  }).from(s.orders).where(eq(s.orders.customerId, customerId));

  const summary = result[0];
  const totalOrders = Number(summary?.totalOrders ?? 0);
  const totalSpentCents = Number(summary?.totalSpentCents ?? 0);

  return {
    totalOrders,
    totalSpentCents,
    averageOrderValueCents: totalOrders > 0 ? Math.round(totalSpentCents / totalOrders) : 0,
    lastOrderDate: summary?.lastOrderDate ?? null,
  };
}

export async function getOpenTasksCount(customerId: string, db: Db = getDb()) {
  const result = await db.select({ count: count() }).from(s.crmTasks).where(and(
    eq(s.crmTasks.customerId, customerId),
    or(eq(s.crmTasks.status, "open"), eq(s.crmTasks.status, "in_progress"))
  ));
  return Number(result[0]?.count ?? 0);
}

export async function findAllAuditEventsForCustomer(customerId: string, db: Db = getDb()) {
  const orderIds = await db.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.customerId, customerId));
  const ids = [customerId, ...orderIds.map((o) => o.id)];

  return db.select().from(s.auditEvents)
    .where(sql`${s.auditEvents.aggregateId} IN (${sql.join(ids, sql`, `)})`)
    .orderBy(desc(s.auditEvents.createdAt))
    .limit(100);
}
