import { supabase } from '../config/supabase.js'

export const dailyMenusService = {
    /**
     * Get all menus for a business
     */
    async getByBusiness(businessId) {
        try {
            const { data, error } = await supabase
                .from('daily_menus')
                .select(`
          *,
          daily_menu_items (
            *,
            products (*)
          )
        `)
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting daily menus:', error)
            throw error
        }
    },

    /**
     * Get the currently active menu for a business
     */
    async getActive(businessId) {
        try {
            const { data, error } = await supabase
                .from('daily_menus')
                .select(`
          *,
          daily_menu_items (
            *,
            products (*)
          )
        `)
                .eq('business_id', businessId)
                .eq('is_active', true)
                .single()

            if (error && error.code !== 'PGRST116') throw error // PGRST116 is specific to .single() not found
            return data // Returns null if no active menu found (and no error thrown for 116 if handled)
        } catch (error) {
            console.error('Error getting active daily menu:', error)
            return null
        }
    },

    /**
     * Create a new menu
     * @param {Object} menuData - { business_id, name, is_active }
     */
    async create(menuData) {
        try {
            const { data, error } = await supabase
                .from('daily_menus')
                .insert([menuData])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error creating daily menu:', error)
            throw error
        }
    },

    /**
     * Update a menu
     */
    async update(menuId, menuData) {
        try {
            const { data, error } = await supabase
                .from('daily_menus')
                .update(menuData)
                .eq('id', menuId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating daily menu:', error)
            throw error
        }
    },

    /**
     * Delete a menu
     */
    async delete(menuId) {
        try {
            const { error } = await supabase
                .from('daily_menus')
                .delete()
                .eq('id', menuId)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting daily menu:', error)
            throw error
        }
    },

    /**
     * Add items to a menu
     * @param {string} menuId 
     * @param {Array<string>} productIds 
     */
    async addItems(menuId, productIds) {
        try {
            const items = productIds.map((productId, index) => ({
                daily_menu_id: menuId,
                product_id: productId,
                display_order: index
            }))

            const { data, error } = await supabase
                .from('daily_menu_items')
                .insert(items)
                .select()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error adding menu items:', error)
            throw error
        }
    },

    /**
     * Replace all items in a menu (Delete all + Insert new)
     */
    async updateItems(menuId, productIds) {
        try {
            // 1. Delete existing items
            const { error: deleteError } = await supabase
                .from('daily_menu_items')
                .delete()
                .eq('daily_menu_id', menuId)

            if (deleteError) throw deleteError

            // 2. Insert new items
            if (productIds.length > 0) {
                return await this.addItems(menuId, productIds)
            }

            return []
        } catch (error) {
            console.error('Error updating menu items:', error)
            throw error
        }
    }
}
