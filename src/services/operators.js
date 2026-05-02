import { supabase } from '../config/supabase.js'

export const operatorsService = {

    /**
     * Get all operators for a business
     * @param {string} businessId 
     */
    async getAll(businessId) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('*')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data
        } catch (error) {
            console.error('operatorsService.getAll error:', error)
            throw error
        }
    },

    /**
     * Get details of a single operator
     * @param {string} id 
     */
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('operatorsService.getById error:', error)
            throw error
        }
    },

    /**
     * Create a new operator
     * @param {Object} data - { business_id, name, permissions }
     */
    async create(data) {
        try {
            const uniqueCode = await this.generateUniqueCode(data.business_id)

            const { data: newOperator, error } = await supabase
                .from('operators')
                .insert([{
                    ...data,
                    unique_code: uniqueCode,
                    is_active: true,
                    auth_user_id: null
                }])
                .select()
                .single()

            if (error) throw error
            return newOperator
        } catch (error) {
            console.error('operatorsService.create error:', error)
            throw error
        }
    },

    /**
     * Generate a unique 5-char alphanumeric code (e.g., OP-A3X9K)
     * @param {string} businessId
     */
    async generateUniqueCode(businessId) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let isUnique = false
        let code = ''

        while (!isUnique) {
            let randomPart = ''
            for (let i = 0; i < 5; i++) {
                randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            code = `OP-${randomPart}`

            const { count } = await supabase
                .from('operators')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', businessId)
                .eq('unique_code', code)

            if (count === 0 || count === null) isUnique = true
        }
        return code
    },

    /**
     * Update an operator
     * @param {string} id 
     * @param {Object} updates 
     */
    async update(id, updates) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('operatorsService.update error:', error)
            throw error
        }
    },

    /**
     * Toggle operator active status
     * @param {string} id 
     * @param {boolean} currentState 
     */
    async toggleActive(id, currentState) {
        try {
            const { data, error } = await supabase
                .from('operators')
                .update({ is_active: !currentState })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('operatorsService.toggleActive error:', error)
            throw error
        }
    },

    /**
     * Delete an operator
     * @param {string} id 
     */
    async delete(id) {
        try {
            const { error } = await supabase
                .from('operators')
                .delete()
                .eq('id', id)

            if (error) throw error
            return true
        } catch (error) {
            console.error('operatorsService.delete error:', error)
            throw error
        }
    },

    /**
     * Validate code and login operator
     * @param {string} code 
     * @param {string} businessId 
     */
    async validateAndLogin(code, businessId) {
        try {
            // 1. Verificar si ya hay sesión activa, si no crear una nueva
            let user = null
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                user = session.user
            } else {
                const { data: { user: newUser }, error: authError } = await supabase.auth.signInAnonymously()
                if (authError) throw authError
                user = newUser
            }

            // 2. Llamar RPC con security definer que valida y vincula
            const { data, error: rpcError } = await supabase.rpc('operator_login', {
                p_code: code.trim().toUpperCase(),
                p_business_id: businessId,
                p_auth_uid: user.id
            })
            if (rpcError) throw rpcError

            // 3. RPC retorna null o error si el código no existe
            if (!data || data.error) {
                await supabase.auth.signOut()
                return { error: data?.error || 'Código inválido o inactivo' }
            }

            return data
        } catch (error) {
            console.error('operatorsService.validateAndLogin error:', error)
            return { error: error.message || 'Error al iniciar sesión' }
        }
    }
}
