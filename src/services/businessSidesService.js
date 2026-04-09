import { supabase } from '../config/supabase.js';

export const businessSidesService = {

    // Obtener todos los acompañantes del negocio
    async getByBusiness(businessId) {
        const { data, error } = await supabase
            .from('business_sides')
            .select('*')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        if (error) throw error;
        return data;
    },

    // Crear nuevo acompañante global
    async create(businessId, { name, price, display_order = 0 }) {
        const { data, error } = await supabase
            .from('business_sides')
            .insert([{ business_id: businessId, name, price, display_order }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Actualizar acompañante global
    async update(sideId, { name, price, display_order }) {
        const { data, error } = await supabase
            .from('business_sides')
            .update({ name, price, display_order, updated_at: new Date().toISOString() })
            .eq('id', sideId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Eliminar (soft delete) acompañante global
    async delete(sideId) {
        const { error } = await supabase
            .from('business_sides')
            .update({ is_active: false })
            .eq('id', sideId);
        if (error) throw error;
    },

    // Obtener acompañantes ya vinculados a un producto específico
    async getByProduct(productId) {
        const { data, error } = await supabase
            .from('product_options')
            .select('id, side_id, name, price, display_order')
            .eq('product_id', productId)
            .eq('type', 'side')
            .not('side_id', 'is', null); // solo los nuevos vinculados
        if (error) throw error;
        return data;
    },

    // Vincular un acompañante global a un producto
    async linkToProduct(productId, side) {
        // side = { id, name, price } proveniente de business_sides
        const { data, error } = await supabase
            .from('product_options')
            .insert([{
                product_id: productId,
                type: 'side',
                name: side.name,
                price: side.price,
                side_id: side.id,
                group_id: null
            }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Desvincular un acompañante de un producto
    async unlinkFromProduct(productOptionId) {
        const { error } = await supabase
            .from('product_options')
            .delete()
            .eq('id', productOptionId);
        if (error) throw error;
    }
};
