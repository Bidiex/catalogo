-- Add order_token to orders table for Order Tracking functionality
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_token UUID;

-- Create index on order_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_token ON orders(order_token);

-- Add checkout_suggestions to businesses table for the Suggestions feature
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS checkout_suggestions JSONB DEFAULT '[]'::jsonb;
