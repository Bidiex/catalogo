-- 1. Create a sequence table to track invoice numbers per business/month
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL, -- Format: 'YYYYMM'
    current_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, year_month)
);

-- Enable RLS on invoice_sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Allow businesses to read/update their own sequences
CREATE POLICY "Businesses can manage their own invoice sequences"
ON public.invoice_sequences
FOR ALL
USING (auth.uid() IN (
    SELECT user_id FROM public.businesses WHERE id = invoice_sequences.business_id
));

-- 2. Add invoice columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'F',
ADD COLUMN IF NOT EXISTS invoice_number INTEGER,
ADD COLUMN IF NOT EXISTS invoice_serial TEXT; -- The full formatted string: FYYYYMM0000

-- Index for searching invoices
CREATE INDEX IF NOT EXISTS idx_orders_invoice_serial ON public.orders(invoice_serial);

-- 3. Function to generate serial
CREATE OR REPLACE FUNCTION public.generate_invoice_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_ym TEXT;
    next_num INTEGER;
BEGIN
    -- Only generate if not already provided (allows manual override if ever needed, though rare)
    IF NEW.invoice_serial IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get current YearMonth (YYYYMM)
    current_ym := to_char(NOW(), 'YYYYMM');

    -- Upsert sequence counter
    INSERT INTO public.invoice_sequences (business_id, year_month, current_count)
    VALUES (NEW.business_id, current_ym, 0)
    ON CONFLICT (business_id, year_month) DO NOTHING;

    -- Increment and get next value
    UPDATE public.invoice_sequences
    SET current_count = current_count + 1,
        updated_at = NOW()
    WHERE business_id = NEW.business_id AND year_month = current_ym
    RETURNING current_count INTO next_num;

    -- Format: F + YYYYMM + 0000 (padded)
    -- Example: F2026020001
    NEW.invoice_prefix := 'F';
    NEW.invoice_number := next_num;
    NEW.invoice_serial := 'F' || current_ym || LPAD(next_num::TEXT, 4, '0');

    RETURN NEW;
END;
$$;

-- 4. Trigger
DROP TRIGGER IF EXISTS set_invoice_serial ON public.orders;
CREATE TRIGGER set_invoice_serial
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_serial();
