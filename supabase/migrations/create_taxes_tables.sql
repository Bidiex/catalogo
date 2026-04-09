-- ========================================================
-- SISTEMA DE IMPUESTOS CONFIGURABLES
-- ========================================================

-- TABLA: Impuestos por Producto (product_taxes)
CREATE TABLE IF NOT EXISTS public.product_taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en product_taxes
ALTER TABLE public.product_taxes ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (necesaria para el catálogo)
CREATE POLICY "Public read product_taxes"
    ON public.product_taxes
    FOR SELECT
    USING (true);

-- Política de gestión para dueños de negocio (necesaria para el dashboard)
CREATE POLICY "Business owner manage product_taxes"
    ON public.product_taxes
    FOR ALL
    USING (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id));


-- TABLA: Impuestos de Factura (invoice_taxes)
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en invoice_taxes
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (necesaria para el catálogo)
CREATE POLICY "Public read invoice_taxes"
    ON public.invoice_taxes
    FOR SELECT
    USING (true);

-- Política de gestión para dueños de negocio (necesaria para el dashboard)
CREATE POLICY "Business owner manage invoice_taxes"
    ON public.invoice_taxes
    FOR ALL
    USING (auth.uid() = (SELECT user_id FROM public.businesses WHERE id = business_id));
