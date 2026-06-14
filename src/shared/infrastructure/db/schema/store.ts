import { pgTable, varchar, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin.ts";

export const storeConfig = pgTable("store_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id),
});
