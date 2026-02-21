-- Add button_color and text_color columns to link_page_items
ALTER TABLE link_page_items
ADD COLUMN IF NOT EXISTS button_color TEXT DEFAULT NULL;

ALTER TABLE link_page_items
ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#ffffff';
