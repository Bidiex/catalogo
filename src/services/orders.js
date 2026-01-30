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
            // IMPORTANT: Import businessService at the top of the file if not already
            // Validate monthly orders limit BEFORE creating order
            const { businessService } = await import('./business.js')
            const limitCheck = await businessService.canCreateOrder(orderData.business_id)

            if (!limitCheck.allowed) {
                const error = new Error(
                    limitCheck.reason === 'plan_expired'
                        ? limitCheck.message
                        : `Has alcanzado el límite de ${limitCheck.limit} pedidos mensuales del plan Plus`
                )
                error.code = 'MONTHLY_LIMIT_REACHED'
                error.details = limitCheck
                throw error
            }

            // Generate ID client-side to avoid RLS Select restriction on "anon" users
            const orderId = crypto.randomUUID()

            // 1. Create the Order
            const { error: orderError } = await supabase
                .from('orders')
                .insert([{ ...orderData, id: orderId }])

            if (orderError) throw orderError

            // Mock the order object since we can't select it
            const order = { ...orderData, id: orderId }

            // 2. Prepare Items with the new Order ID
            const orderItems = items.map(item => ({
                ...item,
                order_id: orderId
            }))

            // 3. Insert Items
            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems)

            if (itemsError) {
                console.error('Error creating items:', itemsError)
                // Note: Anonymous users cannot delete/rollback due to RLS, so we just log and throw
                throw itemsError
            }

            // 4. Increment monthly orders counter (AFTER successful order creation)
            // Only increment for Plus plan (Pro is unlimited, no need to count)
            if (limitCheck.limit && limitCheck.limit !== Infinity) {
                try {
                    await businessService.incrementMonthlyOrders(orderData.business_id)
                } catch (incrementError) {
                    console.error('Error incrementing monthly orders counter:', incrementError)
                    // Don't throw - order was created successfully, just log the counter error
                }
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
     * Get all orders for export within a date range
     * @param {string} businessId
     * @param {Object} options - { startDate, endDate, status }
     */
    async getOrdersForExport(businessId, { startDate, endDate, status = 'all' }) {
        try {
            // Append time to ensure full day coverage
            const startDateTime = `${startDate}T00:00:00`
            const endDateTime = `${endDate}T23:59:59`

            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        quantity,
                        unit_price,
                        product_name,
                        product_id,
                        options
                    )
                `)
                .eq('business_id', businessId)
                .gte('created_at', startDateTime)
                .lte('created_at', endDateTime)
                .order('created_at', { ascending: false })

            // Filter by status
            if (status && status !== 'all') {
                query = query.eq('status', status)
            }

            const { data, error } = await query

            if (error) throw error
            return data
        } catch (error) {
            console.error('ordersService.getOrdersForExport error:', error)
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
