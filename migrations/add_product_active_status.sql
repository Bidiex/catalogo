-- Add is_active column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing products to be active (though default handles new ones, this is safe for existing rows if default didn't apply retrospectively in some DBs, but standard SQL default does apply to new inserts. For existing rows, we want them true)
UPDATE products SET is_active = true WHERE is_active IS NULL;
