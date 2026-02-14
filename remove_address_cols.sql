-- Remove individual address columns from businesses table
ALTER TABLE public.businesses
DROP COLUMN IF EXISTS ciudad,
DROP COLUMN IF EXISTS pais,
DROP COLUMN IF EXISTS codigo_postal;

-- Ensure 'address' column exists (it should, but just in case)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS address TEXT;
