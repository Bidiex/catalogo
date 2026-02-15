-- Add admin_notes column to businesses table if it doesn't exist
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Ensure RLS allows superadmin to read/write this column (implicitly covered by ALL policy, but good to verify)
-- The existing policy "Superadmin full access businesses" covers ALL operations, so no change needed there.
