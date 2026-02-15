-- Add internal_notes column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN public.orders.internal_notes IS 'Notas internas del pedido, visibles solo para el administrador';
