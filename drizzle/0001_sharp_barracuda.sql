CREATE INDEX "idx_carts_customer" ON "carts" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_category_attributes_unique" ON "category_attributes" USING btree ("category_id","attribute_id");--> statement-breakpoint
CREATE INDEX "idx_orders_checkout_session" ON "orders" USING btree ("checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_attributes_unique" ON "product_attributes" USING btree ("product_id","attribute_id");--> statement-breakpoint
CREATE INDEX "idx_refunds_order" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_returns_order" ON "return_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_returns_customer" ON "return_requests" USING btree ("customer_id");