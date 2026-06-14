import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { customers } from "./customers.ts";
import { orders } from "./orders.ts";
import { adminUsers } from "./admin.ts";

export const crmCustomerProfiles = pgTable("crm_customer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull().unique(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  internalSummary: text("internal_summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmCustomerNotes = pgTable("crm_customer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  authorAdminId: uuid("author_admin_id").references(() => adminUsers.id),
  body: text("body").notNull(),
  visibility: varchar("visibility", { length: 30 }).default("internal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_notes_customer_created").on(table.customerId, table.createdAt),
]);

export const crmTags = pgTable("crm_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  color: varchar("color", { length: 30 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmCustomerTags = pgTable("crm_customer_tags", {
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  tagId: uuid("tag_id").references(() => crmTags.id, { onDelete: "cascade" }).notNull(),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_crm_customer_tags_pk").on(table.customerId, table.tagId),
]);

export const crmTasks = pgTable("crm_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => adminUsers.id),
  createdBy: uuid("created_by").references(() => adminUsers.id),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_tasks_customer_status").on(table.customerId, table.status),
  index("idx_crm_tasks_assigned_status_due").on(table.assignedTo, table.status, table.dueAt),
  index("idx_crm_tasks_order").on(table.orderId),
]);

export const crmInteractions = pgTable("crm_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  adminId: uuid("admin_id").references(() => adminUsers.id),
  channel: varchar("channel", { length: 30 }).notNull(),
  direction: varchar("direction", { length: 20 }).default("internal").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_interactions_customer_created").on(table.customerId, table.createdAt),
  index("idx_crm_interactions_order").on(table.orderId),
]);
