-- Migración consolidada: asegura que link_pages tenga todas las columnas requeridas
-- Ejecutar en Supabase SQL Editor si columnas no existen.

DO $$ 
BEGIN 

    -- background_color
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'link_pages' AND column_name = 'background_color'
    ) THEN 
        ALTER TABLE link_pages ADD COLUMN background_color TEXT DEFAULT '#f8fafc';
    END IF;

    -- background_image_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'link_pages' AND column_name = 'background_image_url'
    ) THEN 
        ALTER TABLE link_pages ADD COLUMN background_image_url TEXT;
    END IF;

    -- button_style_default
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'link_pages' AND column_name = 'button_style_default'
    ) THEN 
        ALTER TABLE link_pages ADD COLUMN button_style_default TEXT DEFAULT 'filled';
    END IF;

    -- updated_at en link_page_items (si aplica)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'link_page_items' AND column_name = 'updated_at'
    ) THEN 
        ALTER TABLE link_page_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

END $$;
