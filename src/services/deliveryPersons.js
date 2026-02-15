import { supabase } from '../config/supabase.js'

export const deliveryPersonsService = {

    /**
     * Get all delivery persons for a business with stats
     * @param {string} businessId 
     */
    async getAll(businessId) {
        try {
            // 1. Get all delivery persons
            const { data: persons, error } = await supabase
                .from('delivery_persons')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })

            if (error) throw error

            // 2. Get all orders with a delivery person assigned
            // We only count 'completed' or 'dispatched' or all? 
            // Usually "Total Domicilios" implies completed/successful ones. 
            // Let's count 'completed' for history accuracy.
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('delivery_person_id')
                .eq('business_id', businessId)
                .eq('status', 'completed')
                .not('delivery_person_id', 'is', null)

            if (ordersError) throw ordersError

            // 3. Count per person
            const counts = {}
            orders.forEach(o => {
                counts[o.delivery_person_id] = (counts[o.delivery_person_id] || 0) + 1
            })

            // 4. Merge counts
            const personsWithStats = persons.map(p => ({
                ...p,
                total_deliveries: counts[p.id] || 0
            }))

            return personsWithStats
        } catch (error) {
            console.error('deliveryPersonsService.getAll error:', error)
            throw error
        }
    },

    /**
     * Get details of a single delivery person
     * @param {string} id 
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('delivery_persons')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('deliveryPersonsService.getById error:', error)
            throw error
        }
    },

    /**
     * Create a new delivery person
     * @param {Object} data - { business_id, name, vehicle_type }
     */
    async create(data) {
        try {
            // Generate unique code securely
            const uniqueCode = await this.generateUniqueCode()

            const { data: newPerson, error } = await supabase
                .from('delivery_persons')
                .insert([{
                    ...data,
                    unique_code: uniqueCode,
                    is_active: true
                }])
                .select()
                .single()

            if (error) throw error
            return newPerson
        } catch (error) {
            console.error('deliveryPersonsService.create error:', error)
            throw error
        }
    },

    /**
     * Generate a unique 6-char alphanumeric code (e.g., DP-A3X9K2)
     */
    async generateUniqueCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars like I, 1, O, 0
        let isUnique = false
        let code = ''

        while (!isUnique) {
            let randomPart = ''
            for (let i = 0; i < 6; i++) {
                randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            code = `DP-${randomPart}`

            // Verify uniqueness
            const { count } = await supabase
                .from('delivery_persons')
                .select('*', { count: 'exact', head: true })
                .eq('unique_code', code)

            if (count === 0) isUnique = true
        }
        return code
    },

    /**
     * Update a delivery person
     * @param {string} id 
     * @param {Object} updates 
     */
    async update(id, updates) {
        try {
            const { data, error } = await supabase
                .from('delivery_persons')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('deliveryPersonsService.update error:', error)
            throw error
        }
    },

    /**
     * Delete a delivery person
     * @param {string} id 
     */
    async delete(id) {
        try {
            // Check for active assignments first?
            // RLS might handle it, but better UX to check.
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('delivery_person_id', id)
                .in('status', ['verificado', 'despachado']) // Active statuses

            if (count > 0) {
                throw new Error('No se puede eliminar: tiene pedidos activos asignados.')
            }

            const { error } = await supabase
                .from('delivery_persons')
                .delete()
                .eq('id', id)

            if (error) throw error
            return true
        } catch (error) {
            console.error('deliveryPersonsService.delete error:', error)
            throw error
        }
    },

    /**
     * Get recent history for a delivery person
     */
    async getHistory(id, limit = 10) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, created_at, status, assigned_at, customer_name, total_amount')
                .eq('delivery_person_id', id)
                .order('assigned_at', { ascending: false })
                .limit(limit)

            if (error) throw error
            return data
        } catch (error) {
            console.error('deliveryPersonsService.getHistory error:', error)
            throw error
        }
    }
}
