DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'link_pages' 
        AND column_name = 'background_image_url'
    ) THEN 
        ALTER TABLE link_pages 
        ADD COLUMN background_image_url TEXT;
    END IF;
END $$;
