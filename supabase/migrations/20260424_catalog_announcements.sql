-- 1. Crear tabla catalog_announcements
CREATE TABLE IF NOT EXISTS public.catalog_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    cta_text VARCHAR(30) NOT NULL,
    cta_type TEXT NOT NULL CHECK (cta_type IN ('product', 'promotion', 'none')),
    cta_target_id UUID, -- ID del producto o promoción
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS en la tabla
ALTER TABLE public.catalog_announcements ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para la tabla
-- Cualquiera puede ver anuncios activos de un negocio
CREATE POLICY "Public can view active announcements" ON public.catalog_announcements
    FOR SELECT
    USING (
        is_active = true 
        AND expires_at > now()
    );

-- Solo el dueño del negocio puede gestionar sus anuncios
CREATE POLICY "Owners can manage their announcements" ON public.catalog_announcements
    FOR ALL
    TO authenticated
    USING (
        business_id IN (
            SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
    );

-- 4. Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_announcements_business_active ON public.catalog_announcements(business_id, is_active);

-- 5. Crear Bucket de Almacenamiento para Anuncios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Políticas de RLS para el Bucket announcement-images
-- Lectura pública para cualquier objeto en el bucket announcement-images
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'announcement-images');

-- Solo dueños autenticados pueden subir imágenes a su propia carpeta (prefijada por su ID)
CREATE POLICY "Authenticated users can upload images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'announcement-images' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Solo dueños autenticados pueden borrar sus propias imágenes
CREATE POLICY "Authenticated users can delete their images" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'announcement-images' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
