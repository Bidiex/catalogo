ALTER TABLE link_page_items 
ADD COLUMN IF NOT EXISTS button_style TEXT DEFAULT 'semi-rounded'
CHECK (button_style IN ('filled', 'outlined', 'rounded', 'semi-rounded', 'square'));

ALTER TABLE link_page_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
