-- Add catalog_bg_color column to businesses table
ALTER TABLE businesses
ADD COLUMN catalog_bg_color TEXT DEFAULT '#FFFFFF';

-- RLS handles access: owner can update their business, superadmin can update any.
-- (Existing policies on businesses table should already cover this, but ensuring column is available)
