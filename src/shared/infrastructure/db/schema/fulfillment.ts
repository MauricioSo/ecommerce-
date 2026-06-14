import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, date, index } from "drizzle-orm/pg-core";
import { orders, orderItems } from "./orders.ts";
import { skus } from "./catalog.ts";

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  trackingCode: varchar("tracking_code", { length: 255 }),
  carrier: varchar("carrier", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  estimatedDeliveryDate: date("estimated_delivery_date"),
  trackingUrl: text("tracking_url"),
  providerShipmentId: varchar("provider_shipment_id", { length: 255 }),
  itemsSnapshot: jsonb("items_snapshot"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_shipments_order").on(table.orderId),
]);

export const shipmentEvents = pgTable("shipment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").references(() => shipments.id).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  source: varchar("source", { length: 30 }).notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_shipment_events_shipment_occurred").on(table.shipmentId, table.occurredAt),
  index("idx_shipment_events_status").on(table.status),
]);

export const returnRequests = pgTable("return_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  status: varchar("status", { length: 30 }).default("requested").notNull(),
  resolution: varchar("resolution", { length: 50 }),
  refundAmountCents: integer("refund_amount_cents"),
  exchangeSkuId: uuid("exchange_sku_id").references(() => skus.id),
  adminNotes: text("admin_notes"),
  images: jsonb("images"),
  customerId: uuid("customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_returns_order").on(table.orderId),
  index("idx_returns_customer").on(table.customerId),
]);
