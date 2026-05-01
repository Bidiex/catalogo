-- =============================================================================
-- CORRECCIÓN: RPC delivery_take_order
-- Fecha: 2026-04-27
-- Cambio: WHERE status = 'ready' → 'for_delivery'
-- El status 'ready' nunca existió en producción.
-- El valor correcto es 'for_delivery' (pedido verificado, listo para despachar).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delivery_take_order(p_order_id UUID, p_delivery_person_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE orders
    SET status = 'dispatched',
        delivery_person_id = p_delivery_person_id
    WHERE id = p_order_id
      AND status = 'for_delivery'
      AND delivery_person_id IS NULL;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;
