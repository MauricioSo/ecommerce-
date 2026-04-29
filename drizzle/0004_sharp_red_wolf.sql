CREATE TABLE "category_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_slug" varchar(500) NOT NULL,
	"to_category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_redirects_from_slug_unique" UNIQUE("from_slug")
);
--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"promotion_rule_id" uuid NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "coupon_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_updates" boolean DEFAULT true NOT NULL,
	"shipping_updates" boolean DEFAULT true NOT NULL,
	"promotions" boolean DEFAULT false NOT NULL,
	"restock_alerts" boolean DEFAULT false NOT NULL,
	"review_reminders" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_id" uuid,
	"url" text NOT NULL,
	"alt_text" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_slug" varchar(500) NOT NULL,
	"to_product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_redirects_from_slug_unique" UNIQUE("from_slug")
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_item_id" uuid,
	"rating" smallint NOT NULL,
	"title" varchar(255),
	"body" text,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"helpful_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid NOT NULL,
	"customer_id" uuid,
	"email" varchar(320) NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"results_count" integer NOT NULL,
	"session_id" varchar(255),
	"locale" varchar(10) DEFAULT 'es' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" varchar(255) NOT NULL,
	"synonyms" jsonb NOT NULL,
	"locale" varchar(10) DEFAULT 'es' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"carrier" varchar(100),
	"min_weight_grams" integer DEFAULT 0 NOT NULL,
	"max_weight_grams" integer,
	"min_order_cents" integer DEFAULT 0 NOT NULL,
	"max_order_cents" integer,
	"price_cents" integer NOT NULL,
	"is_free_shipping_eligible" boolean DEFAULT true NOT NULL,
	"free_shipping_threshold_cents" integer,
	"estimated_days_min" integer NOT NULL,
	"estimated_days_max" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"country_code" varchar(3) NOT NULL,
	"regions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_config" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tax_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(3) NOT NULL,
	"region" varchar(255),
	"tax_class" varchar(50) NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_inclusive" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" varchar(255) DEFAULT 'Mi lista' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "country" SET DEFAULT 'CHL';--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "neighborhood" varchar(255);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "is_billing_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "coupon_code" varchar(100);--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "applied_discount_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "tax_cents" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "country_code" varchar(3);--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "customer_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "customer_first_name" varchar(255);--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "customer_last_name" varchar(255);--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_type" varchar(20);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_number" varchar(50);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "locale" varchar(10) DEFAULT 'es';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "country_code" varchar(3);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "country_code" varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "locale" varchar(10) DEFAULT 'es';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "meta_title" varchar(160);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "meta_description" varchar(320);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "meta_keywords" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height_cm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_class" varchar(50) DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "resolution" varchar(50);--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "refund_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "exchange_sku_id" uuid;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "estimated_delivery_date" date;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "provider_shipment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "items_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "category_redirects" ADD CONSTRAINT "category_redirects_to_category_id_categories_id_fk" FOREIGN KEY ("to_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_promotion_rule_id_promotion_rules_id_fk" FOREIGN KEY ("promotion_rule_id") REFERENCES "public"."promotion_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_coupon_id_coupon_codes_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_uses" ADD CONSTRAINT "coupon_uses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_redirects" ADD CONSTRAINT "product_redirects_to_product_id_products_id_fk" FOREIGN KEY ("to_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restock_alerts" ADD CONSTRAINT "restock_alerts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_config" ADD CONSTRAINT "store_config_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_code" ON "coupon_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coupon_uses_unique" ON "coupon_uses" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_customer_sessions_customer" ON "customer_sessions" USING btree ("customer_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_product_images_product" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_product_images_sku" ON "product_images" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_primary" ON "product_images" USING btree ("product_id","is_primary","sort_order");--> statement-breakpoint
CREATE INDEX "idx_reviews_product_approved" ON "product_reviews" USING btree ("product_id","is_approved","created_at");--> statement-breakpoint
CREATE INDEX "idx_reviews_customer" ON "product_reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_restock_alerts_unique" ON "restock_alerts" USING btree ("sku_id","email");--> statement-breakpoint
CREATE INDEX "idx_search_queries_zero_results" ON "search_queries" USING btree ("results_count","created_at");--> statement-breakpoint
CREATE INDEX "idx_search_synonyms_term" ON "search_synonyms" USING btree ("term","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wishlist_items_unique" ON "wishlist_items" USING btree ("wishlist_id","sku_id");--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_exchange_sku_id_skus_id_fk" FOREIGN KEY ("exchange_sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_customer_created" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_featured" ON "products" USING btree ("is_featured","editorial_status");