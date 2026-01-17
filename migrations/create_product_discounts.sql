-- Create product_discounts table
CREATE TABLE IF NOT EXISTS product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create index for faster queries
CREATE INDEX idx_product_discounts_product_id ON product_discounts(product_id);
CREATE INDEX idx_product_discounts_active ON product_discounts(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see discounts for products from their business
CREATE POLICY "Users can view discounts from their business"
  ON product_discounts
  FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Users can insert discounts for their products
CREATE POLICY "Users can create discounts for their products"
  ON product_discounts
  FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT id FROM products
      WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Users can update discounts for their products
CREATE POLICY "Users can update discounts for their products"
  ON product_discounts
  FOR UPDATE
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Users can delete discounts for their products
CREATE POLICY "Users can delete discounts for their products"
  ON product_discounts
  FOR DELETE
  USING (
    product_id IN (
      SELECT id FROM products
      WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Public read access for catalog (no auth required)
CREATE POLICY "Anyone can view active discounts"
  ON product_discounts
  FOR SELECT
  USING (is_active = true);
