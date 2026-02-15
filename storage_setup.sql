-- 1. Add 'image_url' column to products table if it doesn't exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create bucket 'product-images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: Give Superadmins FULL access to 'product-images' bucket
DROP POLICY IF EXISTS "Superadmin full access product-images" ON storage.objects;
CREATE POLICY "Superadmin full access product-images"
ON storage.objects
FOR ALL
USING ( bucket_id = 'product-images' AND (SELECT is_superadmin() FROM public.is_superadmin()) )
WITH CHECK ( bucket_id = 'product-images' AND (SELECT is_superadmin() FROM public.is_superadmin()) );

-- 4. Policy: Allow Public Read Access
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images"
ON storage.objects
FOR SELECT
USING ( bucket_id = 'product-images' );
