-- SQL Migration to add 'dispatched' status

-- Option 1: If using a CHECK constraint on the text column (Most likely based on other Supabase projects)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'verified', 'dispatched', 'completed', 'cancelled'));

-- Option 2: If using a native ENUM type (less common in simple starters but possible)
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'dispatched';
