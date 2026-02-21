DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'link_pages' 
        AND column_name = 'background_color'
    ) THEN 
        ALTER TABLE link_pages 
        ADD COLUMN background_color TEXT DEFAULT '#f8fafc';
    END IF;
END $$;
