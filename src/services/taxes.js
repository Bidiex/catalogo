import { supabase } from '../config/supabase.js'

export const taxesService = {
    // --- Invoice Taxes ---

    async getInvoiceTaxes(businessId) {
        try {
            const { data, error } = await supabase
                .from('invoice_taxes')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching invoice taxes:', error)
            throw error
        }
    },

    async createInvoiceTax(taxData) {
        try {
            const { data, error } = await supabase
                .from('invoice_taxes')
                .insert([taxData])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error creating invoice tax:', error)
            throw error
        }
    },

    async updateInvoiceTax(id, taxData) {
        try {
            const { data, error } = await supabase
                .from('invoice_taxes')
                .update(taxData)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating invoice tax:', error)
            throw error
        }
    },

    async deleteInvoiceTax(id) {
        try {
            const { error } = await supabase
                .from('invoice_taxes')
                .delete()
                .eq('id', id)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting invoice tax:', error)
            throw error
        }
    },

    // --- Product Taxes ---

    async getAllProductTaxes(businessId) {
        try {
            const { data, error } = await supabase
                .from('product_taxes')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching all product taxes:', error)
            throw error
        }
    },

    async getProductTaxes(businessId, productId) {
        try {
            const { data, error } = await supabase
                .from('product_taxes')
                .select('*')
                .eq('business_id', businessId)
                .eq('product_id', productId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error fetching product taxes:', error)
            throw error
        }
    },

    async createProductTax(taxData) {
        try {
            const { data, error } = await supabase
                .from('product_taxes')
                .insert([taxData])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error creating product tax:', error)
            throw error
        }
    },

    async updateProductTax(id, taxData) {
        try {
            const { data, error } = await supabase
                .from('product_taxes')
                .update(taxData)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating product tax:', error)
            throw error
        }
    },

    async deleteProductTax(id) {
        try {
            const { error } = await supabase
                .from('product_taxes')
                .delete()
                .eq('id', id)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting product tax:', error)
            throw error
        }
    }
}
