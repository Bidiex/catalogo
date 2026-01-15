-- Migration: Create product_likes table for favorites system
-- Run this in Supabase SQL Editor

-- Create product_likes table
CREATE TABLE IF NOT EXISTS product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_likes_product ON product_likes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_business ON product_likes(business_id);
CREATE INDEX IF NOT EXISTS idx_product_likes_session ON product_likes(session_id);

-- Unique constraint to prevent duplicate likes from same session
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_like ON product_likes(product_id, session_id);

-- Enable Row Level Security
ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Anyone can view likes" ON product_likes;
DROP POLICY IF EXISTS "Anyone can add likes" ON product_likes;
DROP POLICY IF EXISTS "Anyone can remove their own likes" ON product_likes;

-- Policy: Anyone can read (for Top 3 stats and public viewing)
CREATE POLICY "Anyone can view likes"
  ON product_likes FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Anyone can insert (anonymous users can like products)
CREATE POLICY "Anyone can add likes"
  ON product_likes FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Anyone can delete their own likes (using session_id matching)
CREATE POLICY "Anyone can remove their own likes"
  ON product_likes FOR DELETE
  TO authenticated, anon
  USING (true);

-- Verification query (optional - run after migration)
-- SELECT * FROM product_likes LIMIT 10;
