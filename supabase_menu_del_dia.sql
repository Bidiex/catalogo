-- 1. Add is_active to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Create daily_menus table
CREATE TABLE IF NOT EXISTS daily_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create daily_menu_items table
CREATE TABLE IF NOT EXISTS daily_menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_menu_id UUID REFERENCES daily_menus(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu_items ENABLE ROW LEVEL SECURITY;

-- 5. Policies for daily_menus
CREATE POLICY "Public menus are viewable by everyone" ON daily_menus
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own business menus" ON daily_menus
  FOR INSERT WITH CHECK (auth.uid() IN (
    SELECT user_id FROM businesses WHERE id = business_id
  ));

CREATE POLICY "Users can update their own business menus" ON daily_menus
  FOR UPDATE USING (auth.uid() IN (
    SELECT user_id FROM businesses WHERE id = business_id
  ));

CREATE POLICY "Users can delete their own business menus" ON daily_menus
  FOR DELETE USING (auth.uid() IN (
    SELECT user_id FROM businesses WHERE id = business_id
  ));

-- 6. Policies for daily_menu_items
CREATE POLICY "Public menu items are viewable by everyone" ON daily_menu_items
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their menu items" ON daily_menu_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_menus dm
      JOIN businesses b ON b.id = dm.business_id
      WHERE dm.id = daily_menu_items.daily_menu_id
      AND b.user_id = auth.uid()
    )
  );

-- 7. Function to ensure only one menu is active per business
CREATE OR REPLACE FUNCTION ensure_single_active_menu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE daily_menus
    SET is_active = false
    WHERE business_id = NEW.business_id
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_active_menu
BEFORE INSERT OR UPDATE OF is_active ON daily_menus
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION ensure_single_active_menu();
