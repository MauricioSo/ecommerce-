import { pgTable, uuid, varchar, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, numeric, smallint, date } from "drizzle-orm/pg-core";

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

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id, { onDelete: "cascade" }).notNull().unique(),
  physicalStock: integer("physical_stock").default(0).notNull(),
  reservedStock: integer("reserved_stock").default(0).notNull(),
  adjustedStock: integer("adjusted_stock").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryReservations = pgTable("inventory_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  checkoutSessionId: uuid("checkout_session_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_reservations_sku").on(table.skuId),
  index("idx_reservations_status").on(table.status),
  index("idx_reservations_expires").on(table.expiresAt),
]);

export const inventoryLedger = pgTable("inventory_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  skuId: uuid("sku_id").references(() => skus.id).notNull(),
  delta: integer("delta").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  referenceId: uuid("reference_id"),
  actorId: uuid("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_ledger_sku").on(table.skuId),
]);

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

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkoutSessionId: uuid("checkout_session_id"),
  publicToken: varchar("public_token", { length: 255 }).notNull().unique(),
  customerId: uuid("customer_id"),
  customerEmail: varchar("customer_email", { length: 320 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").default(0).notNull(),
  shippingCostCents: integer("shipping_cost_cents").default(0).notNull(),
  taxCents: integer("tax_cents").default(0).notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  shippingAddress: jsonb("shipping_address"),
  billingAddress: jsonb("billing_address"),
  shippingMethod: varchar("shipping_method", { length: 100 }),
  snapshot: jsonb("snapshot"),
  countryCode: varchar("country_code", { length: 3 }),
  locale: varchar("locale", { length: 10 }).default("es"),
  notes: text("notes"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: varchar("cancellation_reason", { length: 255 }),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_orders_status").on(table.status),
  index("idx_orders_customer").on(table.customerId),
  index("idx_orders_email").on(table.customerEmail),
  index("idx_orders_checkout_session").on(table.checkoutSessionId),
  index("idx_orders_public_token").on(table.publicToken),
  index("idx_orders_customer_created").on(table.customerId, table.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  skuId: uuid("sku_id").notNull(),
  productId: uuid("product_id"),
  productName: varchar("product_name", { length: 500 }).notNull(),
  variantLabel: varchar("variant_label", { length: 255 }),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
}, (table) => [
  index("idx_order_items_order").on(table.orderId),
]);

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

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  trackingCode: varchar("tracking_code", { length: 255 }),
  carrier: varchar("carrier", { length: 100 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  estimatedDeliveryDate: date("estimated_delivery_date"),
  trackingUrl: text("tracking_url"),
  providerShipmentId: varchar("provider_shipment_id", { length: 255 }),
  itemsSnapshot: jsonb("items_snapshot"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_shipments_order").on(table.orderId),
]);

export const shipmentEvents = pgTable("shipment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").references(() => shipments.id).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  source: varchar("source", { length: 30 }).notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_shipment_events_shipment_occurred").on(table.shipmentId, table.occurredAt),
  index("idx_shipment_events_status").on(table.status),
]);

export const returnRequests = pgTable("return_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id).notNull(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id).notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  status: varchar("status", { length: 30 }).default("requested").notNull(),
  resolution: varchar("resolution", { length: 50 }),
  refundAmountCents: integer("refund_amount_cents"),
  exchangeSkuId: uuid("exchange_sku_id").references(() => skus.id),
  adminNotes: text("admin_notes"),
  images: jsonb("images"),
  customerId: uuid("customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_returns_order").on(table.orderId),
  index("idx_returns_customer").on(table.customerId),
]);

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

export const crmCustomerProfiles = pgTable("crm_customer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull().unique(),
  status: varchar("status", { length: 30 }).default("active").notNull(),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  internalSummary: text("internal_summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmCustomerNotes = pgTable("crm_customer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  authorAdminId: uuid("author_admin_id").references(() => adminUsers.id),
  body: text("body").notNull(),
  visibility: varchar("visibility", { length: 30 }).default("internal").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_notes_customer_created").on(table.customerId, table.createdAt),
]);

export const crmTags = pgTable("crm_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  color: varchar("color", { length: 30 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crmCustomerTags = pgTable("crm_customer_tags", {
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  tagId: uuid("tag_id").references(() => crmTags.id, { onDelete: "cascade" }).notNull(),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_crm_customer_tags_pk").on(table.customerId, table.tagId),
]);

export const crmTasks = pgTable("crm_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => adminUsers.id),
  createdBy: uuid("created_by").references(() => adminUsers.id),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_tasks_customer_status").on(table.customerId, table.status),
  index("idx_crm_tasks_assigned_status_due").on(table.assignedTo, table.status, table.dueAt),
  index("idx_crm_tasks_order").on(table.orderId),
]);

export const crmInteractions = pgTable("crm_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  adminId: uuid("admin_id").references(() => adminUsers.id),
  channel: varchar("channel", { length: 30 }).notNull(),
  direction: varchar("direction", { length: 20 }).default("internal").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_crm_interactions_customer_created").on(table.customerId, table.createdAt),
  index("idx_crm_interactions_order").on(table.orderId),
]);

export const storeConfig = pgTable("store_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id),
});
