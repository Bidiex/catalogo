-- Tabla global de acompañantes por negocio
CREATE TABLE public.business_sides (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  display_order INTEGER NULL DEFAULT 0,
  is_active BOOLEAN NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL DEFAULT NOW(),
  CONSTRAINT business_sides_pkey PRIMARY KEY (id),
  CONSTRAINT business_sides_business_id_fkey FOREIGN KEY (business_id)
    REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_sides_business_id
  ON public.business_sides USING BTREE (business_id, display_order);

-- Añadir referencia opcional al acompañante global
ALTER TABLE public.product_options
  ADD COLUMN side_id UUID NULL,
  ADD CONSTRAINT product_options_side_id_fkey
    FOREIGN KEY (side_id) REFERENCES business_sides(id) ON DELETE CASCADE;

CREATE INDEX idx_product_options_side_id
  ON public.product_options USING BTREE (side_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS
ALTER TABLE public.business_sides ENABLE ROW LEVEL SECURITY;

-- 1. Lectura pública (si el acompañante está activo)
CREATE POLICY "Public read access for active sides"
ON public.business_sides FOR SELECT
USING (is_active = true);

-- 2. Lectura para el dueño del negocio (incluso inactivos)
CREATE POLICY "Owner can read own sides"
ON public.business_sides FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 3. Insertar para el dueño
CREATE POLICY "Owner can insert own sides"
ON public.business_sides FOR INSERT
WITH CHECK (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 4. Actualizar para el dueño
CREATE POLICY "Owner can update own sides"
ON public.business_sides FOR UPDATE
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 5. Eliminar para el dueño
CREATE POLICY "Owner can delete own sides"
ON public.business_sides FOR DELETE
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));
