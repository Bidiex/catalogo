-- Enable RLS on key tables
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create helper function to check superadmin status securely
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_roles
    WHERE user_id = auth.uid()
    AND role = 'superadmin'
  );
$$;

-- Policies for admin_roles table
-- Allow users to read their own role (needed for initial checks)
DROP POLICY IF EXISTS "Users can read own role" ON public.admin_roles;
CREATE POLICY "Users can read own role"
  ON public.admin_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Superadmins can manage all roles
DROP POLICY IF EXISTS "Superadmins manage roles" ON public.admin_roles;
CREATE POLICY "Superadmins manage roles"
  ON public.admin_roles
  FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());


-- Policies for admin_logs table
-- Superadmins can view all logs
DROP POLICY IF EXISTS "Superadmins view logs" ON public.admin_logs;
CREATE POLICY "Superadmins view logs"
  ON public.admin_logs
  FOR SELECT
  USING (is_superadmin());

-- Superadmins can create log entries
DROP POLICY IF EXISTS "Superadmins insert logs" ON public.admin_logs;
CREATE POLICY "Superadmins insert logs"
  ON public.admin_logs
  FOR INSERT
  WITH CHECK (is_superadmin());


-- Policies for businesses table (Grant FULL access to Superadmins)
-- Existing policies for business owners likely exist, this adds superadmin capabilities
DROP POLICY IF EXISTS "Superadmin full access businesses" ON public.businesses;
CREATE POLICY "Superadmin full access businesses"
  ON public.businesses
  FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());


-- Policies for products table (Grant FULL access to Superadmins)
DROP POLICY IF EXISTS "Superadmin full access products" ON public.products;
CREATE POLICY "Superadmin full access products"
  ON public.products
  FOR ALL
  USING (is_superadmin())
  WITH CHECK (is_superadmin());
