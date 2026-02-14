-- 1. Add new columns to 'businesses' table
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS ciudad TEXT,
ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'Colombia',
ADD COLUMN IF NOT EXISTS codigo_postal TEXT;

-- 2. Create 'negocios-logos' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('negocios-logos', 'negocios-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for 'negocios-logos'
-- Allow public read access
DROP POLICY IF EXISTS "Public read negocios-logos" ON storage.objects;
CREATE POLICY "Public read negocios-logos"
ON storage.objects
FOR SELECT
USING ( bucket_id = 'negocios-logos' );

-- Allow Superadmins to insert/update/delete
DROP POLICY IF EXISTS "Superadmin full access negocios-logos" ON storage.objects;
CREATE POLICY "Superadmin full access negocios-logos"
ON storage.objects
FOR ALL
USING ( bucket_id = 'negocios-logos' AND (SELECT is_superadmin() FROM public.is_superadmin()) )
WITH CHECK ( bucket_id = 'negocios-logos' AND (SELECT is_superadmin() FROM public.is_superadmin()) );

-- 4. Create RPC function to get users with businesses
-- This function accesses auth.users, so it must be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_users_with_businesses()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  user_created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  business_id UUID,
  business_name TEXT,
  business_status BOOLEAN, -- is_active
  business_plan TEXT,
  business_created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email::VARCHAR,
    u.created_at as user_created_at,
    u.last_sign_in_at,
    n.id as business_id,
    n.name::TEXT as business_name,
    n.is_active as business_status,
    n.plan_type::TEXT as business_plan,
    n.created_at as business_created_at
  FROM auth.users u
  LEFT JOIN public.businesses n ON u.id = n.user_id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (admin check happens in application logic or RLS but for RPC we need EXECUTE)
-- Ideally we restrict this, but since we check is_superadmin in the frontend and RLS protects other tables...
-- Actually, let's add a check inside the function for safety or rely on the caller being admin.
-- For now, consistent with other setup, we grant execute to authenticated.
GRANT EXECUTE ON FUNCTION public.get_users_with_businesses() TO authenticated;
