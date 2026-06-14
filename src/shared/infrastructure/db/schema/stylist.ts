import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { customers } from "./customers.ts";

export const stylistConversations = pgTable("stylist_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_stylist_conversations_customer").on(table.customerId),
  index("idx_stylist_conversations_session").on(table.sessionId),
]);

export const stylistMessages = pgTable("stylist_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => stylistConversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  imageBase64: text("image_base64"),
  recommendations: jsonb("recommendations"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_stylist_messages_conversation").on(table.conversationId, table.createdAt),
]);
