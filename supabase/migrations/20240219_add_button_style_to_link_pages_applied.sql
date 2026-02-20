DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'link_pages' 
        AND column_name = 'button_style_default'
    ) THEN 
        ALTER TABLE link_pages 
        ADD COLUMN button_style_default TEXT DEFAULT 'filled';
    END IF;
END $$;
