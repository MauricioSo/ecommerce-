import { pgTable, uuid, varchar, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { skus } from "./catalog.ts";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  passwordHash: text("password_hash"),
  phone: varchar("phone", { length: 30 }),
  documentType: varchar("document_type", { length: 20 }),
  documentNumber: varchar("document_number", { length: 50 }),
  locale: varchar("locale", { length: 10 }).default("es"),
  countryCode: varchar("country_code", { length: 3 }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  givenAt: timestamp("given_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 100 }),
  line1: varchar("line1", { length: 255 }).notNull(),
  line2: varchar("line2", { length: 255 }),
  neighborhood: varchar("neighborhood", { length: 255 }),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 3 }).default("CHL").notNull(),
  phone: varchar("phone", { length: 30 }),
  reference: text("reference"),
  isDefault: boolean("is_default").default(false).notNull(),
  isBillingDefault: boolean("is_billing_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wishlists = pgTable("wishlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).default("Mi lista").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  wishlistId: uuid("wishlist_id").references(() => wishlists.id, { onDelete: "cascade" }).notNull(),
  skuId: uuid("sku_id").references(() => skus.id, { onDelete: "cascade" }).notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_wishlist_items_unique").on(table.wishlistId, table.skuId),
]);

export const customerSessions = pgTable("customer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
}, (table) => [
  index("idx_customer_sessions_customer").on(table.customerId, table.expiresAt),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull().unique(),
  orderUpdates: boolean("order_updates").default(true).notNull(),
  shippingUpdates: boolean("shipping_updates").default(true).notNull(),
  promotions: boolean("promotions").default(false).notNull(),
  restockAlerts: boolean("restock_alerts").default(false).notNull(),
  reviewReminders: boolean("review_reminders").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const restockAlerts = pgTable("restock_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_restock_alerts_unique").on(table.skuId, table.email),
]);
