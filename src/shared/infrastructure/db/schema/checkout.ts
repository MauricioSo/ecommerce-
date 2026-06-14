import { pgTable, uuid, varchar, timestamp, jsonb, integer, text, uniqueIndex } from "drizzle-orm/pg-core";
import { skus } from "./catalog.ts";

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: varchar("session_id", { length: 255 }),
  customerId: uuid("customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_carts_session_unique").on(table.sessionId),
  uniqueIndex("idx_carts_customer_unique").on(table.customerId),
]);

export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: "cascade" }).notNull(),
  skuId: uuid("sku_id").references(() => skus.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_cart_items_cart_sku").on(table.cartId, table.skuId),
]);

export const checkoutSessions = pgTable("checkout_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").references(() => carts.id).notNull(),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  customerEmail: varchar("customer_email", { length: 320 }),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  shippingMethod: varchar("shipping_method", { length: 100 }),
  shippingCostCents: integer("shipping_cost_cents"),
  idempotencyKey: varchar("idempotency_key", { length: 256 }),
  couponCode: varchar("coupon_code", { length: 100 }),
  appliedDiscountCents: integer("applied_discount_cents").default(0),
  taxCents: integer("tax_cents").default(0),
  countryCode: varchar("country_code", { length: 3 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  customerFirstName: varchar("customer_first_name", { length: 255 }),
  customerLastName: varchar("customer_last_name", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_checkout_idempotency").on(table.idempotencyKey),
]);
