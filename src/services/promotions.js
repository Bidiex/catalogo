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
        // 1. Fetch ALL active promotions (regardless of date)
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .eq('business_id', businessId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) throw error

        const now = new Date()
        const validPromotions = []
        const updates = []

        // 2. Filter and maintenance
        for (const promo of data) {
            let isValid = true

            // Check Start Date (Future)
            if (promo.start_date) {
                const start = new Date(promo.start_date)
                if (start > now) {
                    isValid = false // Not started yet, but keep active
                }
            }

            // Check End Date (Expired)
            if (promo.end_date) {
                const end = new Date(promo.end_date)
                if (end < now) {
                    isValid = false
                    // Auto-deactivate in background
                    updates.push(
                        this.update(promo.id, { is_active: false })
                    )
                }
            }

            if (isValid) {
                validPromotions.push(promo)
            }
        }

        // Execute updates in parallel (don't await to keep UI fast, or await if critical)
        // We catch errors to avoid breaking the fetch
        Promise.all(updates).catch(err => console.error('Error auto-deactivating promos:', err))

        return validPromotions
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
