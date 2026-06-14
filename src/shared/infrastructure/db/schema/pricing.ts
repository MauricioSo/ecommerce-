import { pgTable, uuid, varchar, integer, boolean, timestamp, jsonb, index, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { orders } from "./orders.ts";
import { customers } from "./customers.ts";

export const priceLists = pgTable("price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const promotionRules = pgTable("promotion_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  discountValue: integer("discount_value").notNull(),
  discountType: varchar("discount_type", { length: 30 }).notNull(),
  conditions: jsonb("conditions"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const couponCodes = pgTable("coupon_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  promotionRuleId: uuid("promotion_rule_id").references(() => promotionRules.id, { onDelete: "cascade" }).notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_coupon_codes_code").on(table.code),
]);

export const couponUses = pgTable("coupon_uses", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponId: uuid("coupon_id").references(() => couponCodes.id).notNull(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_coupon_uses_unique").on(table.couponId, table.orderId),
]);

export const shippingZones = pgTable("shipping_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  countryCode: varchar("country_code", { length: 3 }).notNull(),
  regions: jsonb("regions"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shippingRates = pgTable("shipping_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id").references(() => shippingZones.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  carrier: varchar("carrier", { length: 100 }),
  minWeightGrams: integer("min_weight_grams").default(0).notNull(),
  maxWeightGrams: integer("max_weight_grams"),
  minOrderCents: integer("min_order_cents").default(0).notNull(),
  maxOrderCents: integer("max_order_cents"),
  priceCents: integer("price_cents").notNull(),
  isFreeShippingEligible: boolean("is_free_shipping_eligible").default(true).notNull(),
  freeShippingThresholdCents: integer("free_shipping_threshold_cents"),
  estimatedDaysMin: integer("estimated_days_min").notNull(),
  estimatedDaysMax: integer("estimated_days_max").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const taxRules = pgTable("tax_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryCode: varchar("country_code", { length: 3 }).notNull(),
  region: varchar("region", { length: 255 }),
  taxClass: varchar("tax_class", { length: 50 }).notNull(),
  ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isInclusive: boolean("is_inclusive").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
