



-- Política para permitir que los superadmins eliminen productos de cualquier negocio
-- Siguiendo el patrón de verificación en la tabla admin_roles
CREATE POLICY "Superadmins can delete products" ON public.products
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  )
);
