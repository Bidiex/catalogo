-- Create product_badges table
CREATE TABLE IF NOT EXISTS public.product_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_badge_assignments table
CREATE TABLE IF NOT EXISTS public.product_badge_assignments (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES public.product_badges(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.product_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_badge_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for product_badges
DROP POLICY IF EXISTS "Anyone can read product badges" ON public.product_badges;
CREATE POLICY "Anyone can read product badges" ON public.product_badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage badges for their businesses" ON public.product_badges;
CREATE POLICY "Users can manage badges for their businesses" ON public.product_badges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.businesses
            WHERE businesses.id = product_badges.business_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- Policies for product_badge_assignments
DROP POLICY IF EXISTS "Anyone can read product badge assignments" ON public.product_badge_assignments;
CREATE POLICY "Anyone can read product badge assignments" ON public.product_badge_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage badge assignments for their products" ON public.product_badge_assignments;
CREATE POLICY "Users can manage badge assignments for their products" ON public.product_badge_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products
            JOIN public.businesses ON businesses.id = products.business_id
            WHERE products.id = product_badge_assignments.product_id
            AND businesses.owner_id = auth.uid()
        )
    );

-- Insert system badge "Nuevo"
INSERT INTO public.product_badges (id, business_id, name, color)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Nuevo', '#10b981')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color;
