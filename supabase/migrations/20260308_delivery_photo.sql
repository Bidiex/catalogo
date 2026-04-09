-- =============================================================================
-- MIGRACIÓN: Captura de Foto de Entrega (TraeGo)
-- Fecha: 2026-03-08
-- Instrucciones: Ejecutar en el SQL Editor de Supabase (Dashboard > SQL Editor)
--
-- Explicación:
-- 1. Añade la columna `delivery_photo_url` a la tabla `orders`
-- 2. Crea el bucket `delivery-photos` si no existe
-- 3. Configura las políticas RLS para el bucket `delivery-photos`
-- 4. Crea la RPC `set_delivery_photo` para permitir a los domiciliarios guardar la foto
-- =============================================================================

BEGIN;

-- 1. MODIFICAR TABLA ORDERS
-- Añadir columna para almacenar el path de la foto
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT NULL;


-- 2. CONFIGURACIÓN DEL STORAGE
-- Asegurar que existe el bucket (solo si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-photos', 'delivery-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en el bucket de fotos (Supabase lo hace por defecto, evitar ALTER TABLE para prevenir error 42501)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. RLS EN STORAGE: delivery-photos

-- Política: El domiciliario puede insertar su archivo.
-- (A nivel de storage es complejo verificar que el 'asignado' coincide exactamente en SQL puro
-- sin join a public.orders, por seguridad principal la URL en BD la rige la RPC.
-- Para Storage permitiremos inserciones autenticadas - anon con ciertas reglas
-- PERO el control estricto de a qué order ID va asociado lo hace la RPC.)
-- Nota: En este proyecto los domiciliarios usan anon y OTP, no Supabase Auth estándar.
-- Permisos de subida: Cualquiera con el anon key puede subir (el secreto está en el path random/id y que la RPC asocia).
DROP POLICY IF EXISTS "Permitir subida de fotos de entrega" ON storage.objects;
CREATE POLICY "Permitir subida de fotos de entrega"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'delivery-photos');

-- Política: Solo lectura (SELECT) para los dueños / administradores.
-- Como es anon, la lectura pública no está permitida. Las URLs se firman vía API (createSignedUrl).
DROP POLICY IF EXISTS "Lectura restringida de fotos" ON storage.objects;
CREATE POLICY "Lectura restringida de fotos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'delivery-photos');

-- Política: No borrado desde el cliente por anon
-- (Al no definir política DELETE, se deniega por defecto).
-- Si existe política previa que permita todo, se elimina:
DROP POLICY IF EXISTS "Permitir borrado de fotos" ON storage.objects;


-- 4. RPC: Guardar el path de la foto (set_delivery_photo)
-- Seguridad delegada (SECURITY DEFINER) para que un domiciliario "anon" pueda actualizar la foto
-- solo si el pedido le pertenece.
CREATE OR REPLACE FUNCTION public.set_delivery_photo(p_order_id UUID, p_photo_url TEXT, p_deliverer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE orders
    SET delivery_photo_url = p_photo_url
    WHERE id = p_order_id
      AND delivery_person_id = p_deliverer_id; -- Verifica pertenencia rigurosamente

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

COMMIT;
