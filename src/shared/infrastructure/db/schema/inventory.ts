import { pgTable, uuid, integer, varchar, timestamp, index } from "drizzle-orm/pg-core";
import { skus } from "./catalog.ts";

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id, { onDelete: "cascade" }).notNull().unique(),
  physicalStock: integer("physical_stock").default(0).notNull(),
  reservedStock: integer("reserved_stock").default(0).notNull(),
  adjustedStock: integer("adjusted_stock").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryReservations = pgTable("inventory_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  checkoutSessionId: uuid("checkout_session_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_reservations_sku").on(table.skuId),
  index("idx_reservations_status").on(table.status),
  index("idx_reservations_expires").on(table.expiresAt),
]);

export const inventoryLedger = pgTable("inventory_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id).notNull(),
  delta: integer("delta").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  referenceId: uuid("reference_id"),
  actorId: uuid("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ledger_sku").on(table.skuId),
]);
