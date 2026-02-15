-- Set default value for priority column
ALTER TABLE "public"."support_tickets" 
ALTER COLUMN "priority" SET DEFAULT 'normal';

-- Optional: Update existing NULL priorities to 'normal' if any
UPDATE "public"."support_tickets" 
SET "priority" = 'normal' 
WHERE "priority" IS NULL;
