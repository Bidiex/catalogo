-- ==========================================
-- ORDERS MANAGEMENT SCHEMA
-- ==========================================

-- 1. Create ORDERS table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  customer_neighborhood TEXT,
  order_notes TEXT,
  delivery_price NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- 'efectivo', 'nequi', 'daviplata', etc.
  status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'completed', 'cancelled'
  channel TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create ORDER_ITEMS table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id), -- Nullable in case product is deleted later, we keep the record
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  options JSONB, -- Stores selected sides, variants, quick comments, etc.
  is_promotion BOOLEAN DEFAULT false
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- ORDERS POLICIES
-- Authentication:
-- Customers (Public/Anon) can INSERT orders.
-- Business Owners (Authenticated) can SELECT, UPDATE, DELETE their own orders.

-- Policy: Allow Public Insert (for Checkout)
CREATE POLICY "Public can create orders" 
ON orders FOR INSERT 
WITH CHECK (true);

-- Policy: Business Owners can View their Orders
-- Assuming 'businesses' table has a 'user_id' column linked to auth.users
-- If not, we need a way to link the auth user to the business_id.
-- Standard Pattern: user_id is in businesses table.
CREATE POLICY "Owners can view their orders"
ON orders FOR SELECT
USING (
  business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  )
);

-- Policy: Owners can Update their Orders (e.g. status)
CREATE POLICY "Owners can update their orders"
ON orders FOR UPDATE
USING (
  business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  )
);

-- Policy: Owners can Delete their Orders
CREATE POLICY "Owners can delete their orders"
ON orders FOR DELETE
USING (
  business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  )
);


-- ORDER ITEMS POLICIES
-- Policy: Allow Public Insert (for Checkout)
CREATE POLICY "Public can create order items" 
ON order_items FOR INSERT 
WITH CHECK (true);

-- Policy: Owners can View Items of their Orders
CREATE POLICY "Owners can view their order items"
ON order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders WHERE business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  )
);

-- Create simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 5. Enable Realtime
-- IMPORTANT: You must run this to enable realtime listener for new orders
-- Run this in Supabase SQL Editor:
-- alter publication supabase_realtime add table orders;
