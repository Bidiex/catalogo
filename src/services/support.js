import { supabase } from '../config/supabase.js'

export const supportService = {
    /**
     * Obtiene todos los tickets de un negocio
     * @param {string} businessId
     * @returns {Promise<Array>}
     */
    async getByBusiness(businessId) {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Crea un nuevo ticket de soporte
     * @param {Object} ticketData
     * @returns {Promise<Object>}
     */
    async create(ticketData) {
        const { data, error } = await supabase
            .from('support_tickets')
            .insert([ticketData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Elimina un ticket de soporte
     * @param {string} ticketId
     * @returns {Promise<void>}
     */
    async delete(ticketId) {
        const { error } = await supabase
            .from('support_tickets')
            .delete()
            .eq('id', ticketId)

        if (error) throw error
    }
}
