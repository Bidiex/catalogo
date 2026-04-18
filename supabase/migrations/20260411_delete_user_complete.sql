-- ============================================================
-- RPC: delete_user_complete
-- Elimina un usuario y TODOS sus datos asociados de forma segura.
-- Respeta el orden de FK para evitar errores de integridad referencial.
-- Incluye limpieza de admin_logs, businesses y el usuario de auth.users.
-- SECURITY DEFINER: se ejecuta con privilegios del owner de la función.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_user_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_business_id uuid;
    v_result      jsonb := '{}'::jsonb;
    v_count       integer;
BEGIN
    -- Verificar que el usuario existe
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'Usuario con id % no existe', target_user_id;
    END IF;

    -- Obtener el business_id (puede ser NULL si el usuario no tiene negocio)
    SELECT id INTO v_business_id
    FROM public.businesses
    WHERE user_id = target_user_id
    LIMIT 1;

    -- --------------------------------------------------------
    -- BLOQUE 1: Datos relacionados con el negocio
    -- --------------------------------------------------------
    IF v_business_id IS NOT NULL THEN

        -- 1. admin_logs (FK → businesses AND FK → auth.users)
        DELETE FROM public.admin_logs
        WHERE business_id = v_business_id OR admin_id = target_user_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('admin_logs', v_count);

        -- 2. support_tickets (FK → businesses AND FK → auth.users)
        DELETE FROM public.support_tickets
        WHERE business_id = v_business_id OR user_id = target_user_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('support_tickets', v_count);

        -- 3. order_items (FK → orders → business)
        DELETE FROM public.order_items
        WHERE order_id IN (
            SELECT id FROM public.orders WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('order_items', v_count);

        -- 4. orders (FK → businesses, delivery_persons)
        DELETE FROM public.orders WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('orders', v_count);

        -- 5. delivery_persons (FK → businesses)
        DELETE FROM public.delivery_persons WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('delivery_persons', v_count);

        -- 6. daily_menu_items (FK → daily_menus, products)
        DELETE FROM public.daily_menu_items
        WHERE daily_menu_id IN (
            SELECT id FROM public.daily_menus WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('daily_menu_items', v_count);

        -- 7. product_likes (FK → products, businesses)
        DELETE FROM public.product_likes WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_likes', v_count);

        -- 8. product_discounts (FK → products)
        DELETE FROM public.product_discounts
        WHERE product_id IN (
            SELECT id FROM public.products WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_discounts', v_count);

        -- 9. product_options (FK → products, product_option_groups, business_sides)
        DELETE FROM public.product_options
        WHERE product_id IN (
            SELECT id FROM public.products WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_options', v_count);

        -- 10. product_option_group_assignments (FK → products, product_option_groups)
        DELETE FROM public.product_option_group_assignments
        WHERE product_id IN (
            SELECT id FROM public.products WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_option_group_assignments', v_count);

        -- 11. product_option_groups (FK → products, businesses)
        DELETE FROM public.product_option_groups WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_option_groups', v_count);

        -- 12. product_sizes (FK → products)
        DELETE FROM public.product_sizes
        WHERE product_id IN (
            SELECT id FROM public.products WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_sizes', v_count);

        -- 13. product_taxes (FK → products, businesses)
        DELETE FROM public.product_taxes WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('product_taxes', v_count);

        -- 14. products (FK → businesses, categories)
        DELETE FROM public.products WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('products', v_count);

        -- 15. categories (FK → businesses)
        DELETE FROM public.categories WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('categories', v_count);

        -- 16. promotion_options (FK → promotions)
        DELETE FROM public.promotion_options
        WHERE promotion_id IN (
            SELECT id FROM public.promotions WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('promotion_options', v_count);

        -- 17. promotions (FK → businesses)
        DELETE FROM public.promotions WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('promotions', v_count);

        -- 18. business_sides (FK → businesses)
        DELETE FROM public.business_sides WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('business_sides', v_count);

        -- 19. business_hours (FK → businesses)
        DELETE FROM public.business_hours WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('business_hours', v_count);

        -- 20. business_stats (FK → businesses)
        DELETE FROM public.business_stats WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('business_stats', v_count);

        -- 21. invoice_sequences (FK → businesses)
        DELETE FROM public.invoice_sequences WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('invoice_sequences', v_count);

        -- 22. invoice_taxes (FK → businesses)
        DELETE FROM public.invoice_taxes WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('invoice_taxes', v_count);

        -- 23. payment_methods (FK → businesses)
        DELETE FROM public.payment_methods WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('payment_methods', v_count);

        -- 24. link_page_items (FK → link_pages)
        DELETE FROM public.link_page_items
        WHERE link_page_id IN (
            SELECT id FROM public.link_pages WHERE business_id = v_business_id
        );
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('link_page_items', v_count);

        -- 25. link_pages (FK → businesses)
        DELETE FROM public.link_pages WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('link_pages', v_count);

        -- 26. daily_menus (FK → businesses) — ahora que daily_menu_items ya fue borrado
        DELETE FROM public.daily_menus WHERE business_id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('daily_menus', v_count);

        -- 27. businesses
        DELETE FROM public.businesses WHERE id = v_business_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_result := v_result || jsonb_build_object('businesses', v_count);

    ELSE
        -- Sin negocio: aún puede tener admin_logs o support_tickets por user_id
        DELETE FROM public.admin_logs WHERE admin_id = target_user_id;
        DELETE FROM public.support_tickets WHERE user_id = target_user_id;
        v_result := v_result || jsonb_build_object('admin_logs', 0, 'businesses', 0);
    END IF;

    -- --------------------------------------------------------
    -- BLOQUE 2: Datos directamente ligados al user (sin negocio)
    -- --------------------------------------------------------

    -- 28. admin_roles (FK → auth.users)
    DELETE FROM public.admin_roles WHERE user_id = target_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('admin_roles', v_count);

    -- 29. Eliminar usuario de auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('auth_user_deleted', v_count);

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error eliminando usuario %: % (SQLSTATE: %)',
            target_user_id, SQLERRM, SQLSTATE;
END;
$$;

-- Revocar acceso público y otorgar solo a service_role/authenticated admins
REVOKE ALL ON FUNCTION delete_user_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_complete(uuid) TO authenticated;

COMMENT ON FUNCTION delete_user_complete(uuid) IS
'Elimina un usuario y TODOS sus datos asociados: negocio, productos, órdenes, etc.
Solo debe ser llamada desde el panel de superadmin. Operación IRREVERSIBLE.';
