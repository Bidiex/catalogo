-- Create promotion_options table
CREATE TABLE IF NOT EXISTS promotion_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('quick_comment', 'side')),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_promotion_options_promotion_id ON promotion_options(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_options_type ON promotion_options(type);

-- Enable RLS (Row Level Security)
ALTER TABLE promotion_options ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON promotion_options
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON promotion_options TO authenticated;
GRANT ALL ON promotion_options TO service_role;
