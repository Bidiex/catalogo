import { supabase } from '../config/supabase.js'

export const promotionsService = {
    /**
     * Obtener promociones por ID de negocio
     */
    async getByBusiness(businessId) {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Obtener promociones activas para el catálogo
     */
    async getActiveByBusiness(businessId) {
        const now = new Date().toISOString()

        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .or(`start_date.is.null,start_date.lte.${now}`)
            .or(`end_date.is.null,end_date.gte.${now}`)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Crear promoción
     */
    async create(promotion) {
        const { data, error } = await supabase
            .from('promotions')
            .insert([promotion])
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Actualizar promoción
     */
    async update(id, updates) {
        const { data, error } = await supabase
            .from('promotions')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Eliminar promoción
     */
    async delete(id) {
        const { error } = await supabase
            .from('promotions')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}
