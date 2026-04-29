ALTER TABLE "orders" ADD COLUMN "public_token" varchar(255);--> statement-breakpoint
UPDATE "orders" SET "public_token" = gen_random_uuid()::text WHERE "public_token" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "public_token" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_orders_public_token" ON "orders" USING btree ("public_token");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_public_token_unique" UNIQUE("public_token");
