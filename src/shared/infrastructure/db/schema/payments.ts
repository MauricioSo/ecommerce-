import { pgTable, uuid, varchar, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { orders } from "./orders.ts";

export const paymentAttempts = pgTable("payment_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerIntentId: varchar("provider_intent_id", { length: 255 }),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 256 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_payment_attempts_order").on(table.orderId),
  uniqueIndex("idx_payment_idempotency").on(table.idempotencyKey),
]);

export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").references(() => paymentAttempts.id).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_payment_tx_attempt").on(table.attemptId),
  uniqueIndex("idx_payment_tx_provider_event").on(table.providerEventId),
]);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  paymentAttemptId: uuid("payment_attempt_id").references(() => paymentAttempts.id).notNull(),
  amountCents: integer("amount_cents").notNull(),
  reason: varchar("reason", { length: 255 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  providerRefundId: varchar("provider_refund_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_refunds_order").on(table.orderId),
]);
