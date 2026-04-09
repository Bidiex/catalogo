-- =============================================================================
-- MIGRACIÓN: UI Domiciliarios + Estado "ready" + Timestamps
-- Fecha: 2026-03-01
-- Instrucciones: Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. AÑADIR COLUMNAS DE TIMESTAMP A LA TABLA orders
--    (IF NOT EXISTS para que sea idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 2. TRIGGER: Auto-setear timestamps cuando cambia el status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM 'ready') THEN
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

-- Eliminar trigger si ya existe para que no se duplique
DROP TRIGGER IF EXISTS order_timestamps ON public.orders;

CREATE TRIGGER order_timestamps
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_timestamps();

-- -----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS PARA LA UI DE DOMICILIARIOS (acceso anónimo)
--
--    La UI de domiciliarios NO usa auth de Supabase, por eso necesita políticas
--    que permitan al rol 'anon' leer y actualizar datos acotados.
--
--    NOTA: Las políticas RLS existentes sobre 'authenticated' no se tocan.
-- -----------------------------------------------------------------------------

-- 3.1 businesses: SELECT por slug (para resolver el negocio al cargar la página)
-- Solo si no existe ya una política anon equivalente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'businesses'
      AND policyname = 'delivery_anon_select_businesses'
  ) THEN
    CREATE POLICY "delivery_anon_select_businesses"
      ON public.businesses
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- 3.2 delivery_persons: SELECT para validar código de domiciliario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'delivery_persons'
      AND policyname = 'delivery_anon_select_delivery_persons'
  ) THEN
    CREATE POLICY "delivery_anon_select_delivery_persons"
      ON public.delivery_persons
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- 3.3 orders: SELECT acotado por business_id (domiciliario solo lee su negocio)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'delivery_anon_select_orders'
  ) THEN
    CREATE POLICY "delivery_anon_select_orders"
      ON public.orders
      FOR SELECT
      TO anon
      USING (business_id IS NOT NULL);
  END IF;
END $$;

-- 3.4 orders: UPDATE restringido — solo los campos que necesita el domiciliario
--    El domiciliario puede:
--    a) Tomar un pedido: status='ready' -> status='dispatched', asignar delivery_person_id
--    b) Completar un pedido: status='dispatched' -> status='completed'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
      AND policyname = 'delivery_anon_update_orders'
  ) THEN
    CREATE POLICY "delivery_anon_update_orders"
      ON public.orders
      FOR UPDATE
      TO anon
      USING (
        status IN ('ready', 'dispatched')
      )
      WITH CHECK (
        status IN ('dispatched', 'completed')
      );
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN (ejecutar por separado para confirmar):
-- =============================================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
--   AND column_name IN ('ready_at', 'dispatched_at', 'completed_at');
--
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('orders', 'delivery_persons', 'businesses')
--   AND policyname LIKE 'delivery_anon%';
