import { supabase } from '../config/supabase.js'

export const productDiscountsService = {
    /**
     * Obtener descuento de un producto
     */
    async getByProduct(productId) {
        try {
            const { data, error } = await supabase
                .from('product_discounts')
                .select('*')
                .eq('product_id', productId)
                .maybeSingle() // Use maybeSingle instead of single to avoid error when no record

            if (error) {
                // Log but don't throw - just return null for these cases
                console.warn('Error fetching discount (returning null):', error.message)
                return null
            }
            return data
        } catch (error) {
            console.error('Error getting product discount:', error)
            // Return null instead of throwing to prevent breaking the UI
            return null
        }
    },

    /**
     * Obtener todos los descuentos activos de un negocio
     */
    async getActiveByBusiness(businessId) {
        try {
            const { data, error } = await supabase
                .from('product_discounts')
                .select(`
          *,
          products!inner(business_id)
        `)
                .eq('products.business_id', businessId)
                .eq('is_active', true)

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting active discounts:', error)
            throw error
        }
    },

    /**
     * Crear descuento
     */
    async create(discountData) {
        try {
            const { data, error } = await supabase
                .from('product_discounts')
                .insert([{
                    ...discountData,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error creating discount:', error)
            throw error
        }
    },

    /**
     * Actualizar descuento
     */
    async update(productId, discountData) {
        try {
            const { data, error } = await supabase
                .from('product_discounts')
                .update({
                    ...discountData,
                    updated_at: new Date().toISOString()
                })
                .eq('product_id', productId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating discount:', error)
            throw error
        }
    },

    /**
     * Eliminar descuento
     */
    async delete(productId) {
        try {
            const { error } = await supabase
                .from('product_discounts')
                .delete()
                .eq('product_id', productId)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting discount:', error)
            throw error
        }
    },

    /**
     * Validar si un descuento está activo y dentro del rango de fechas
     */
    isDiscountValid(discount) {
        if (!discount || !discount.is_active) return false

        const today = new Date()
        today.setHours(0, 0, 0, 0) // Resetear hora para comparar solo fechas

        const startDate = new Date(discount.start_date)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(discount.end_date)
        endDate.setHours(23, 59, 59, 999) // Incluir todo el día final

        return today >= startDate && today <= endDate
    },

    /**
     * Calcular precio con descuento
     */
    calculateDiscountedPrice(originalPrice, discountPercentage) {
        const discount = (originalPrice * discountPercentage) / 100
        return originalPrice - discount
    }
}
