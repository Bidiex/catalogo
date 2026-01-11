import { supabase } from '../config/supabase.js'

export const promotionOptionsService = {
    /**
     * Obtener opciones de una promoción
     */
    async getByPromotion(promotionId) {
        try {
            const { data, error } = await supabase
                .from('promotion_options')
                .select('*')
                .eq('promotion_id', promotionId)
                .order('display_order', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting promotion options:', error)
            throw error
        }
    },

    /**
     * Obtener opciones por tipo
     */
    async getByType(promotionId, type) {
        try {
            const { data, error } = await supabase
                .from('promotion_options')
                .select('*')
                .eq('promotion_id', promotionId)
                .eq('type', type)
                .order('display_order', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting promotion options by type:', error)
            throw error
        }
    },

    /**
     * Crear opción
     */
    async create(optionData) {
        try {
            const { data, error } = await supabase
                .from('promotion_options')
                .insert([optionData])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error creating promotion option:', error)
            throw error
        }
    },

    /**
     * Actualizar opción
     */
    async update(optionId, optionData) {
        try {
            const { data, error } = await supabase
                .from('promotion_options')
                .update(optionData)
                .eq('id', optionId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating promotion option:', error)
            throw error
        }
    },

    /**
     * Eliminar opción
     */
    async delete(optionId) {
        try {
            const { error } = await supabase
                .from('promotion_options')
                .delete()
                .eq('id', optionId)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting promotion option:', error)
            throw error
        }
    }
}
