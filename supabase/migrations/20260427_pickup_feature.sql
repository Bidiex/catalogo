-- =============================================================================
-- MIGRACIÓN: Funcionalidad "Retirar en tienda" (Pickup)
-- Fecha: 2026-04-27
-- Instrucciones: Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABLA businesses: agregar pickup_enabled y delivery_enabled
--    Con CHECK que impide dejar ambos en false.
-- -----------------------------------------------------------------------------

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS pickup_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN NOT NULL DEFAULT true;

-- Constraint: al menos uno de los dos modos debe estar activo
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS chk_at_least_one_mode_enabled;

ALTER TABLE public.businesses
  ADD CONSTRAINT chk_at_least_one_mode_enabled
    CHECK (pickup_enabled = true OR delivery_enabled = true);

-- Backfill seguro: todos los negocios existentes mantienen delivery activo (ya es true por DEFAULT)
-- pickup_enabled queda en false por DEFAULT, lo que es correcto: opt-in.

-- -----------------------------------------------------------------------------
-- 2. TABLA orders: agregar order_type
--    Valores permitidos: 'delivery' | 'pickup'
--    Constraint adicional: 'ready_for_pickup' solo es coherente con order_type='pickup'
-- -----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'delivery';

-- Validar que order_type solo tenga valores conocidos
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_order_type_values;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_order_type_values
    CHECK (order_type IN ('delivery', 'pickup'));

-- Coherencia entre order_type y status:
-- 'ready_for_pickup' solo puede existir si order_type = 'pickup'
-- 'for_delivery' solo puede existir si order_type = 'delivery'
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_order_type_status_coherence;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_order_type_status_coherence
    CHECK (
      (status = 'ready_for_pickup' AND order_type = 'pickup')
      OR (status = 'for_delivery'  AND order_type = 'delivery')
      OR (status NOT IN ('ready_for_pickup', 'for_delivery'))
    );

-- Backfill: todos los pedidos existentes son de tipo 'delivery' (ya es el DEFAULT)

-- -----------------------------------------------------------------------------
-- 3. TRIGGER: extender set_order_timestamps para el nuevo status
--    (reemplaza la función definida en 20260301_delivery_ui.sql)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Timestamp para pickup listo para retirar
  IF NEW.status = 'ready_for_pickup' AND (OLD.status IS DISTINCT FROM 'ready_for_pickup') THEN
    NEW.ready_at = NOW();
  END IF;

  IF NEW.status = 'dispatched' AND (OLD.status IS DISTINCT FROM 'dispatched') THEN
    NEW.dispatched_at = NOW();
  END IF;

  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe desde 20260301_delivery_ui.sql, solo actualizamos la función.

-- -----------------------------------------------------------------------------
-- 4. POLÍTICA RLS: delivery_anon_update_orders
--    Ampliar para que el domiciliario siga funcionando correctamente.
--    Solo se actualiza la política existente.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- Eliminar y recrear para actualizar la definición
  DROP POLICY IF EXISTS "delivery_anon_update_orders" ON public.orders;

  CREATE POLICY "delivery_anon_update_orders"
    ON public.orders
    FOR UPDATE
    TO anon
    USING (
      status IN ('for_delivery', 'dispatched')
    )
    WITH CHECK (
      status IN ('dispatched', 'completed')
    );
END $$;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN (ejecutar por separado para confirmar):
-- =============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'businesses'
--   AND column_name IN ('pickup_enabled', 'delivery_enabled');
--
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
--   AND column_name = 'order_type';
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.orders'::regclass
--   AND conname IN ('chk_order_type_values', 'chk_order_type_status_coherence');
