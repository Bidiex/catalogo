-- Tabla principal: una por negocio (relación 1:1)
CREATE TABLE IF NOT EXISTS link_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  button_style TEXT NOT NULL DEFAULT 'semi-rounded'
    CHECK (button_style IN ('filled', 'outlined', 'rounded', 'semi-rounded', 'square')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id)
);

-- Ítems/botones de cada página
CREATE TABLE IF NOT EXISTS link_page_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link_page_id UUID NOT NULL REFERENCES link_pages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_catalog_link BOOLEAN NOT NULL DEFAULT false,
  is_deletable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE link_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_page_items ENABLE ROW LEVEL SECURITY;

-- Políticas para link_pages

-- 1. Lectura pública (si está publicada) - Permitir a cualquiera ver las páginas publicadas
CREATE POLICY "Public read access for published link pages"
ON link_pages FOR SELECT
USING (is_published = true);

-- 2. Lectura para el dueño del negocio
CREATE POLICY "Owner can read own link page"
ON link_pages FOR SELECT
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 3. Insertar para el dueño (al crear su página)
CREATE POLICY "Owner can insert own link page"
ON link_pages FOR INSERT
WITH CHECK (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 4. Actualizar para el dueño
CREATE POLICY "Owner can update own link page"
ON link_pages FOR UPDATE
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));

-- 5. Eliminar para el dueño
CREATE POLICY "Owner can delete own link page"
ON link_pages FOR DELETE
USING (auth.uid() IN (
  SELECT user_id FROM businesses WHERE id = business_id
));


-- Políticas para link_page_items

-- 1. Lectura pública (si el item está activo y la página publicada)
CREATE POLICY "Public read access for active items"
ON link_page_items FOR SELECT
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM link_pages 
    WHERE id = link_page_items.link_page_id 
    AND is_published = true
  )
);

-- 2. Gestión total para el dueño del negocio asociado a la página
CREATE POLICY "Owner can manage items"
ON link_page_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM link_pages
    JOIN businesses ON businesses.id = link_pages.business_id
    WHERE link_pages.id = link_page_items.link_page_id
    AND businesses.user_id = auth.uid()
  )
);
