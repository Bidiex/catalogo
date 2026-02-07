-- Add header_background_url column to businesses table
-- This will store the public URL of the header background image

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS header_background_url TEXT;

-- Add comment to column
COMMENT ON COLUMN businesses.header_background_url IS 'Public URL of the catalog header background image';
