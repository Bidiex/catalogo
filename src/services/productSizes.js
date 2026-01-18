import { supabase } from '../config/supabase.js'

export const productSizesService = {
    /**
     * Get all sizes for a product
     */
    async getByProduct(productId) {
        const { data, error } = await supabase
            .from('product_sizes')
            .select('*')
            .eq('product_id', productId)
            .order('display_order', { ascending: true })
            .order('price', { ascending: true })

        if (error) throw error
        return data || []
    },

    /**
     * Create a new size
     */
    async create(size) {
        const { data, error } = await supabase
            .from('product_sizes')
            .insert([size])
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Update a size
     */
    async update(id, updates) {
        const { data, error } = await supabase
            .from('product_sizes')
            .update(updates)
            .eq('id', id)
            .select()

        if (error) throw error
        if (!data || data.length === 0) return null
        return data[0]
    },

    /**
     * Delete a size
     */
    async delete(id) {
        const { error } = await supabase
            .from('product_sizes')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}
