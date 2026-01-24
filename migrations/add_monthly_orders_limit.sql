-- ============================================
-- MIGRACIÓN: Agregar Límite de Pedidos Mensuales
-- ============================================
-- Este script agrega el sistema de límite de pedidos mensuales
-- para diferenciar entre Plan Plus (300/mes) y Plan Pro (ilimitado)

-- Paso 1: Agregar nuevas columnas a la tabla businesses
-- Son opcionales (nullable) para no romper registros existentes

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS monthly_orders_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plan_renewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Paso 2: Inicializar plan_renewed_at para negocios existentes
-- Lo calculamos como plan_expires_at - 30 días
-- Esto da a cada negocio existente un ciclo de facturación coherente

UPDATE businesses
SET plan_renewed_at = plan_expires_at - INTERVAL '30 days'
WHERE plan_renewed_at IS NULL;

-- Paso 3: Crear función RPC para incrementar el contador de pedidos
-- Esta función se llamará desde el cliente cada vez que se cree un pedido exitosamente
-- SECURITY DEFINER permite que se ejecute con permisos de dueño de la función

CREATE OR REPLACE FUNCTION increment_monthly_orders(business_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE businesses
  SET monthly_orders_count = COALESCE(monthly_orders_count, 0) + 1
  WHERE id = business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 4: Verificar que todo se creó correctamente
-- Ejecuta estas queries para verificar:

-- Ver estructura de la tabla
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'businesses' 
-- AND column_name IN ('monthly_orders_count', 'plan_renewed_at');

-- Ver la función creada
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name = 'increment_monthly_orders';

-- Ver algunos negocios con los nuevos campos
-- SELECT id, name, plan_type, monthly_orders_count, plan_renewed_at, plan_expires_at 
-- FROM businesses 
-- LIMIT 5;
