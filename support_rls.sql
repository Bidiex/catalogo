-- Enable Row Level Security (RLS) on the table
ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;

-- Policy for Admins to VIEW all tickets
CREATE POLICY "Admins can view all support tickets"
ON "public"."support_tickets"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.role = 'superadmin'
  )
);

-- Policy for Admins to UPDATE tickets (status, etc.)
CREATE POLICY "Admins can update support tickets"
ON "public"."support_tickets"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_roles
    WHERE admin_roles.user_id = auth.uid()
    AND admin_roles.role = 'superadmin'
  )
);

-- Policy for Businesses to VIEW their OWN tickets
CREATE POLICY "Businesses can view own tickets"
ON "public"."support_tickets"
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Policy for Businesses to CREATE tickets
CREATE POLICY "Businesses can create tickets"
ON "public"."support_tickets"
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);
