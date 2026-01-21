import { supabase } from '../config/supabase.js'

export const ordersService = {

    /**
     * Creates a new order and its items.
     * @param {Object} orderData - { business_id, customer_name, customer_phone, ... }
     * @param {Array} items - Array of { product_id, product_name, quantity, unit_price, ... }
     * @returns {Object} Created order
     */
    async createOrder(orderData, items) {
        try {
            // 1. Create the Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single()

            if (orderError) throw orderError

            if (!order) throw new Error('Failed to create order record')

            // 2. Prepare Items with the new Order ID
            const orderItems = items.map(item => ({
                ...item,
                order_id: order.id
            }))

            // 3. Insert Items
            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems)

            if (itemsError) {
                // Rollback: try to delete the order if items failed (Manual Transaction)
                console.error('Error creating items, rolling back order...', itemsError)
                await supabase.from('orders').delete().eq('id', order.id)
                throw itemsError
            }

            return order
        } catch (error) {
            console.error('ordersService.createOrder error:', error)
            throw error
        }
    },

    /**
     * Get orders for a business with pagination and filtering
     * @param {string} businessId 
     * @param {Object} options - { page, limit, status, search }
     */
    async getByBusiness(businessId, { page = 1, limit = 20, status = 'all', search = '' }) {
        try {
            const from = (page - 1) * limit
            const to = from + limit - 1

            let query = supabase
                .from('orders')
                .select('*', { count: 'exact' })
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })
                .range(from, to)

            // Filter by status
            if (status && status !== 'all') {
                query = query.eq('status', status)
            }

            // Filter by search (Customer Name or Phone)
            if (search) {
                query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
            }

            const { data, count, error } = await query

            if (error) throw error

            return { data, count }
        } catch (error) {
            console.error('ordersService.getByBusiness error:', error)
            throw error
        }
    },

    /**
     * Get full details of an order including items
     * @param {string} orderId 
     */
    async getOrderDetails(orderId) {
        try {
            // Get Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single()

            if (orderError) throw orderError

            // Get Items
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId)

            if (itemsError) throw itemsError

            return { ...order, items }
        } catch (error) {
            console.error('ordersService.getOrderDetails error:', error)
            throw error
        }
    },

    /**
     * Update order status
     * @param {string} orderId 
     * @param {string} newStatus 
     */
    async updateStatus(orderId, newStatus) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('ordersService.updateStatus error:', error)
            throw error
        }
    },

    /**
     * Delete an order
     * @param {string} orderId 
     */
    async deleteOrder(orderId) {
        try {
            // Cascade delete handles items usually, but explicit request is safe
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId)

            if (error) throw error
            return true
        } catch (error) {
            console.error('ordersService.deleteOrder error:', error)
            throw error
        }
    }
}
