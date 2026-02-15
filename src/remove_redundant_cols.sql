-- Eliminar columnas redundantes de la tabla businesses
ALTER TABLE businesses 
DROP COLUMN IF EXISTS plan,
DROP COLUMN IF EXISTS total_pedidos,
DROP COLUMN IF EXISTS fecha_fin_trial,
DROP COLUMN IF EXISTS estado,
DROP COLUMN IF EXISTS ultimo_acceso;

-- Asegurar que las columnas necesarias existan y tengan defaults correctos (opcional, validación)
-- ALTER TABLE businesses ALTER COLUMN plan_type SET DEFAULT 'plus';
-- ALTER TABLE businesses ALTER COLUMN is_active SET DEFAULT true;
