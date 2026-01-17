-- Script to fix RLS policies for product_discounts table
-- Run this in Supabase SQL Editor if you already created the table

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view discounts from their business" ON product_discounts;
DROP POLICY IF EXISTS "Anyone can view active discounts" ON product_discounts;
DROP POLICY IF EXISTS "Users can create discounts for their products" ON product_discounts;
DROP POLICY IF EXISTS "Users can update discounts for their products" ON product_discounts;
DROP POLICY IF EXISTS "Users can delete discounts for their products" ON product_discounts;

-- Create corrected SELECT policy that works for both authenticated and public
CREATE POLICY "View discounts for business products or active public"
  ON product_discounts
  FOR SELECT
  USING (
    -- Allow if user owns the business (for dashboard)
    (
      auth.uid() IS NOT NULL AND
      product_id IN (
        SELECT id FROM products
        WHERE business_id IN (
          SELECT id FROM businesses WHERE user_id = auth.uid()
        )
      )
    )
    OR
    -- Allow if discount is active (for public catalog)
    (is_active = true)
  );

-- Recreate other policies
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
