-- =============================================================================
-- MIGRACIÓN: Seguridad UI Domiciliarios (Procedimientos Almacenados)
-- Fecha: 2026-03-07
-- Instrucciones: Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
--
-- Explicación: Esta migración elimina el permiso general "UPDATE" en orders
-- para usuarios anónimos y lo reemplaza por 3 funciones RPC (Remote Procedure Calls)
-- con seguridad delegada (SECURITY DEFINER) para blindar el acceso y
-- permitir la edición de notas incluso en pedidos 'completed'.
-- =============================================================================

BEGIN;

-- 1. ELIMINAR LA POLÍTICA VULNERABLE
-- Esto impide que cualquier usuario anónimo modifique la tabla orders libremente.
DROP POLICY IF EXISTS "delivery_anon_update_orders" ON public.orders;


-- 2. RPC: Tomar un pedido (handleTakeOrder)
-- Permite pasar un pedido de 'ready' a 'dispatched' vinculándolo a un domiciliario.
CREATE OR REPLACE FUNCTION public.delivery_take_order(p_order_id UUID, p_delivery_person_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con permisos bypass RLS
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE orders
    SET status = 'dispatched',
        delivery_person_id = p_delivery_person_id
    WHERE id = p_order_id
      AND status = 'ready'
      AND delivery_person_id IS NULL; -- Asegurar que nadie más lo ha tomado

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;


-- 3. RPC: Completar un pedido (handleCompleteOrder)
-- Permite pasar un pedido de 'dispatched' a 'completed' solo si pertenece al domiciliario.
CREATE OR REPLACE FUNCTION public.delivery_complete_order(p_order_id UUID, p_delivery_person_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE orders
    SET status = 'completed'
    WHERE id = p_order_id
      AND status = 'dispatched'
      AND delivery_person_id = p_delivery_person_id; -- Verificar pertenencia

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0; -- Devuelve true si afectó a una fila
END;
$$;


-- 4. RPC: Actualizar notas del domiciliario (noteSave)
-- Permite a un domiciliario guardar notas en un pedido (independiente del status).
CREATE OR REPLACE FUNCTION public.delivery_update_note(p_order_id UUID, p_delivery_person_id UUID, p_note TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE orders
    SET delivery_notes = p_note
    WHERE id = p_order_id
      AND delivery_person_id = p_delivery_person_id; -- Solo puede dejar notas en SUS pedidos
      
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

COMMIT;
