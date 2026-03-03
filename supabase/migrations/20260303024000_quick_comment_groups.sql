-- Agregar columna business_id para asociar el grupo al negocio, no al producto
ALTER TABLE product_option_groups ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;

-- Hacer product_id opcional
ALTER TABLE product_option_groups ALTER COLUMN product_id DROP NOT NULL;

-- Agregar catalog_name
ALTER TABLE product_option_groups ADD COLUMN catalog_name varchar(255);

-- Crear tabla intermedia
CREATE TABLE product_option_group_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, group_id)
);

-- Migración de datos existentes
-- 1. Asignar el business_id a los grupos basados en el producto al que pertenecen
UPDATE product_option_groups pog
SET business_id = p.business_id
FROM products p
WHERE pog.product_id = p.id;

-- 2. Migrar product_id a assignments para mantener la relación actual
INSERT INTO product_option_group_assignments (product_id, group_id, display_order)
SELECT product_id, id, display_order
FROM product_option_groups
WHERE product_id IS NOT NULL;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS
ALTER TABLE public.product_option_group_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Lectura pública
CREATE POLICY "Public read access for assignments"
ON public.product_option_group_assignments FOR SELECT
USING (true);

-- 2. Insertar para el dueño del negocio (vía producto)
CREATE POLICY "Owner can insert assignments"
ON public.product_option_group_assignments FOR INSERT
WITH CHECK (auth.uid() IN (
  SELECT b.user_id 
  FROM products p
  JOIN businesses b ON p.business_id = b.id
  WHERE p.id = product_id
));

-- 3. Actualizar para el dueño del negocio
CREATE POLICY "Owner can update assignments"
ON public.product_option_group_assignments FOR UPDATE
USING (auth.uid() IN (
  SELECT b.user_id 
  FROM products p
  JOIN businesses b ON p.business_id = b.id
  WHERE p.id = product_id
));

-- 4. Eliminar para el dueño del negocio
CREATE POLICY "Owner can delete assignments"
ON public.product_option_group_assignments FOR DELETE
USING (auth.uid() IN (
  SELECT b.user_id 
  FROM products p
  JOIN businesses b ON p.business_id = b.id
  WHERE p.id = product_id
));

