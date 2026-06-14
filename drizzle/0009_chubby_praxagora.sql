CREATE TABLE "stylist_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"session_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stylist_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"image_base64" text,
	"recommendations" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_carts_session";--> statement-breakpoint
DROP INDEX "idx_carts_customer";--> statement-breakpoint
ALTER TABLE "stylist_conversations" ADD CONSTRAINT "stylist_conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stylist_messages" ADD CONSTRAINT "stylist_messages_conversation_id_stylist_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."stylist_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stylist_conversations_customer" ON "stylist_conversations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_stylist_conversations_session" ON "stylist_conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_stylist_messages_conversation" ON "stylist_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_carts_session_unique" ON "carts" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_carts_customer_unique" ON "carts" USING btree ("customer_id");