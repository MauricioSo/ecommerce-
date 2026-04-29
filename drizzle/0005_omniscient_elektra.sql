CREATE TABLE "crm_customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_admin_id" uuid,
	"body" text NOT NULL,
	"visibility" varchar(30) DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"internal_summary" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_customer_profiles_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "crm_customer_tags" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"admin_id" uuid,
	"channel" varchar(30) NOT NULL,
	"direction" varchar(20) DEFAULT 'internal' NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(30),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"assigned_to" uuid,
	"created_by" uuid,
	"type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" varchar(30) NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_author_admin_id_admin_users_id_fk" FOREIGN KEY ("author_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_profiles" ADD CONSTRAINT "crm_customer_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_tag_id_crm_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."crm_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_assigned_by_admin_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_notes_customer_created" ON "crm_customer_notes" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crm_customer_tags_pk" ON "crm_customer_tags" USING btree ("customer_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_customer_created" ON "crm_interactions" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_order" ON "crm_interactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_customer_status" ON "crm_tasks" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_assigned_status_due" ON "crm_tasks" USING btree ("assigned_to","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_order" ON "crm_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_shipment_events_shipment_occurred" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_shipment_events_status" ON "shipment_events" USING btree ("status");