-- Adds item_type to distinguish regular links from social media links
ALTER TABLE link_page_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'link'
    CHECK (item_type IN ('link', 'social'));

-- Adds which social network this item represents (only for item_type = 'social')
ALTER TABLE link_page_items
  ADD COLUMN IF NOT EXISTS social_network TEXT DEFAULT NULL
    CHECK (social_network IN ('facebook', 'instagram', 'youtube', 'twitter', NULL));
