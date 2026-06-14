import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload"),
  actorId: uuid("actor_id"),
  correlationId: varchar("correlation_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_audit_aggregate").on(table.aggregateType, table.aggregateId),
  index("idx_audit_correlation").on(table.correlationId),
]);
