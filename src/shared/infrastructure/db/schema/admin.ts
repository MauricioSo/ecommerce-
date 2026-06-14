import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 50 }).default("admin").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_admin_users_email").on(table.email),
]);

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id").references(() => adminUsers.id, { onDelete: "cascade" }).notNull(),
  tokenJti: varchar("token_jti", { length: 64 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ROLES = {
  super_admin: {
    label: "Super Admin",
    permissions: ["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write", "payments:read", "payments:write", "promotions:read", "promotions:write", "admin_users:read", "admin_users:write", "reconciliation:run", "crm:read", "crm:write"],
  },
  catalog_manager: {
    label: "Catalog Manager",
    permissions: ["catalog:read", "catalog:write", "inventory:read", "promotions:read", "promotions:write"],
  },
  operations_manager: {
    label: "Operations Manager",
    permissions: ["catalog:read", "inventory:read", "inventory:write", "orders:read", "orders:write", "payments:read", "promotions:read", "reconciliation:run", "crm:read", "crm:write"],
  },
  support_agent: {
    label: "Support Agent",
    permissions: ["catalog:read", "orders:read", "payments:read", "inventory:read", "crm:read", "crm:write"],
  },
} as const;

export type AdminRole = keyof typeof ROLES;
export type Permission = (typeof ROLES)[AdminRole]["permissions"][number];
