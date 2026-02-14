-- Add RLS policies for Categories table to allow Superadmin access

-- 1. Enable RLS (if not already enabled, though good practice to ensure)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Policy for Superadmins to manage ALL categories
-- This uses the is_superadmin() function defined in superadmin_setup.sql
DROP POLICY IF EXISTS "Superadmin full access categories" ON public.categories;
CREATE POLICY "Superadmin full access categories"
  ON public.categories
  FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- 3. Policy for Business Owners (Already exists likely, but ensuring they can see/edit their own)
-- "Users can view their own business categories"
-- DROP POLICY IF EXISTS "Business owners view categories" ON public.categories;
-- CREATE POLICY "Business owners view categories"
--   ON public.categories
--   FOR SELECT
--   USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
--
-- Note: We typically rely on the service role or existing policies for owners. 
-- The critical missing piece was Superadmin access.
