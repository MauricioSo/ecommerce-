import { pgTable, uuid, varchar, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, numeric, smallint } from "drizzle-orm/pg-core";
import { customers } from "./customers.ts";
import { orderItems } from "./orders.ts";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  parentId: uuid("parent_id"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attributes = pgTable("attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  options: jsonb("options"),
  isRequired: boolean("is_required").default(false).notNull(),
  isFilterable: boolean("is_filterable").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categoryAttributes = pgTable("category_attributes", {
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  attributeId: uuid("attribute_id").references(() => attributes.id, { onDelete: "cascade" }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  uniqueIndex("idx_category_attributes_unique").on(table.categoryId, table.attributeId),
]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),
  metaTitle: varchar("meta_title", { length: 160 }),
  metaDescription: varchar("meta_description", { length: 320 }),
  metaKeywords: text("meta_keywords"),
  brand: varchar("brand", { length: 255 }),
  weightGrams: integer("weight_grams"),
  lengthCm: numeric("length_cm", { precision: 8, scale: 2 }),
  widthCm: numeric("width_cm", { precision: 8, scale: 2 }),
  heightCm: numeric("height_cm", { precision: 8, scale: 2 }),
  taxClass: varchar("tax_class", { length: 50 }).default("standard"),
  isFeatured: boolean("is_featured").default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  categoryId: uuid("category_id").references(() => categories.id),
  editorialStatus: varchar("editorial_status", { length: 30 }).default("draft").notNull(),
  baseImage: text("base_image"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_products_category").on(table.categoryId),
  index("idx_products_status").on(table.editorialStatus),
  index("idx_products_featured").on(table.isFeatured, table.editorialStatus),
]);

export const productAttributes = pgTable("product_attributes", {
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  attributeId: uuid("attribute_id").references(() => attributes.id).notNull(),
  value: text("value").notNull(),
}, (table) => [
  uniqueIndex("idx_product_attributes_unique").on(table.productId, table.attributeId),
]);

export const skus = pgTable("skus", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  variantLabel: varchar("variant_label", { length: 255 }),
  priceCents: integer("price_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  compareAtPriceCents: integer("compare_at_price_cents"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_skus_product").on(table.productId),
]);

export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  skuId: uuid("sku_id").references(() => skus.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  altText: varchar("alt_text", { length: 500 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_product_images_product").on(table.productId, table.sortOrder),
  index("idx_product_images_sku").on(table.skuId),
  index("idx_product_images_primary").on(table.productId, table.isPrimary, table.sortOrder),
]);

export const productReviews = pgTable("product_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
  rating: smallint("rating").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
  isApproved: boolean("is_approved").default(false).notNull(),
  helpfulVotes: integer("helpful_votes").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_reviews_product_approved").on(table.productId, table.isApproved, table.createdAt),
  index("idx_reviews_customer").on(table.customerId),
]);

export const categoryRedirects = pgTable("category_redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromSlug: varchar("from_slug", { length: 500 }).notNull().unique(),
  toCategoryId: uuid("to_category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const productRedirects = pgTable("product_redirects", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromSlug: varchar("from_slug", { length: 500 }).notNull().unique(),
  toProductId: uuid("to_product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchSynonyms = pgTable("search_synonyms", {
  id: uuid("id").primaryKey().defaultRandom(),
  term: varchar("term", { length: 255 }).notNull(),
  synonyms: jsonb("synonyms").notNull(),
  locale: varchar("locale", { length: 10 }).default("es").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_search_synonyms_term").on(table.term, table.locale),
]);

export const searchQueries = pgTable("search_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: text("query").notNull(),
  resultsCount: integer("results_count").notNull(),
  sessionId: varchar("session_id", { length: 255 }),
  locale: varchar("locale", { length: 10 }).default("es").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_search_queries_zero_results").on(table.resultsCount, table.createdAt),
]);
