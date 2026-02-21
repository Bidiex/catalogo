-- Migración para añadir el color del texto del negocio (text_color) a la tabla link_pages
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'link_pages' AND column_name = 'text_color'
    ) THEN 
        ALTER TABLE link_pages ADD COLUMN text_color TEXT DEFAULT '#0f172a';
    END IF;
END $$;
