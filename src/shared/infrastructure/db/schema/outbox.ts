import { pgTable, uuid, varchar, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload"),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(5).notNull(),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_outbox_status").on(table.status),
  index("idx_outbox_next_retry").on(table.nextRetryAt),
]);
