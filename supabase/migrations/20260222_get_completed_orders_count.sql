-- Función pública para contar pedidos completados
-- SECURITY DEFINER permite que se ejecute con privilegios del propietario,
-- saltando el RLS de la tabla orders de forma segura.
CREATE OR REPLACE FUNCTION get_completed_orders_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM orders WHERE status = 'completed';
$$;
