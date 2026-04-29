INSERT INTO categories (id, name, slug, description, sort_order, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Electronics', 'electronics', 'Electronic devices and gadgets', 0, true),
  ('a0000000-0000-0000-0000-000000000002', 'Clothing', 'clothing', 'Apparel and accessories', 1, true)
ON CONFLICT DO NOTHING;

INSERT INTO attributes (id, name, slug, type, options, is_required, is_filterable) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Color', 'color', 'select', '["Black","White","Red","Blue"]'::jsonb, false, true),
  ('b0000000-0000-0000-0000-000000000002', 'Size', 'size', 'select', '["S","M","L","XL"]'::jsonb, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO category_attributes (category_id, attribute_id, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 0)
ON CONFLICT DO NOTHING;

INSERT INTO products (id, name, slug, description, category_id, editorial_status) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Wireless Headphones', 'wireless-headphones', 'Premium noise-cancelling wireless headphones', 'a0000000-0000-0000-0000-000000000001', 'published'),
  ('c0000000-0000-0000-0000-000000000002', 'USB-C Cable', 'usb-c-cable', 'Fast charging USB-C cable, 2m', 'a0000000-0000-0000-0000-000000000001', 'draft')
ON CONFLICT DO NOTHING;

INSERT INTO skus (id, product_id, sku, variant_label, price_cents, currency, is_active) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'WH-BLK-001', 'Black', 7999, 'USD', true),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'WH-WHT-001', 'White', 7999, 'USD', true),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'USBC-001', NULL, 1299, 'USD', true)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_items (id, sku_id, physical_stock, reserved_stock, adjusted_stock) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 100, 0, 0),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 50, 0, 0),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 200, 0, 0)
ON CONFLICT DO NOTHING;

INSERT INTO inventory_ledger (id, sku_id, delta, reason) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 100, 'stock_receipt'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 50, 'stock_receipt'),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 200, 'stock_receipt')
ON CONFLICT DO NOTHING;
