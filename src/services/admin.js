import { supabase } from '../config/supabase.js'

export const adminService = {
    // --- NEGOCIOS ---

    /**
     * Obtener todos los negocios
     */
    async getBusinesses() {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (getBusinesses):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Obtener usuarios con sus negocios (RPC)
     */
    async getUsersWithBusinesses() {
        try {
            const { data, error } = await supabase.rpc('get_users_with_businesses')
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (getUsersWithBusinesses):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Crear negocio para usuario
     */
    async createBusiness(userId, businessData) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .insert([{
                    user_id: userId,
                    name: businessData.name,
                    whatsapp_number: businessData.phone,
                    description: businessData.description,
                    plan_type: businessData.plan || 'free',
                    is_active: businessData.is_active !== undefined ? businessData.is_active : true, // Default active/trial
                    plan_expires_at: businessData.plan_expires_at,
                    // New fields
                    address: businessData.address
                }])
                .select()
                .single()

            if (error) throw error

            await this.logAction(null, data.id, 'CREATE_BUSINESS_ADMIN', { userId, name: businessData.name })

            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (createBusiness):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Obtener negocio por ID
     */
    async getBusinessById(businessId) {
        try {
            // Get business data
            const { data: business, error: businessError } = await supabase
                .from('businesses')
                .select('*')
                .eq('id', businessId)
                .single()

            if (businessError) throw businessError

            // Get counts (parallel)
            const [productsResult, ordersResult] = await Promise.all([
                supabase.from('products').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
                supabase.from('orders').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
            ])

            const data = {
                ...business,
                products_count: productsResult.count || 0,
                orders_count: ordersResult.count || 0
            }

            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (getBusinessById):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Actualizar negocio
     */
    async updateBusiness(businessId, updates) {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .update(updates)
                .eq('id', businessId)
                .select()
                .single()

            if (error) throw error

            // Log automático
            await this.logAction(null, businessId, 'UPDATE_BUSINESS', { updates })

            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (updateBusiness):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Obtener estadísticas simples de negocios
     */
    async getBusinessStats() {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('is_active, plan_type')

            if (error) throw error

            const stats = {
                total: data.length,
                active: data.filter(b => b.is_active).length,
                inactive: data.filter(b => !b.is_active).length,
                pro: data.filter(b => b.plan_type === 'pro').length,
                plus: data.filter(b => b.plan_type === 'plus').length,
            }

            return { success: true, data: stats }
        } catch (error) {
            console.error('Admin API Error (getBusinessStats):', error)
            return { success: false, error: error.message }
        }
    },

    // --- PRODUCTOS ---

    /**
     * Obtener productos de un negocio
     */
    async getProductsByBusiness(businessId) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, categories(name)')
                .eq('business_id', businessId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (getProductsByBusiness):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Crear producto
     */
    async createProduct(businessId, productData) {
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{ ...productData, business_id: businessId }])
                .select()
                .single()

            if (error) throw error

            await this.logAction(null, businessId, 'CREATE_PRODUCT', { productId: data.id })

            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (createProduct):', error)
            return { success: false, error: error.message }
        }
    },

    /**
     * Eliminar producto
     */
    async deleteProduct(productId, businessId) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId)

            if (error) throw error

            await this.logAction(null, businessId, 'DELETE_PRODUCT', { productId })

            return { success: true }
        } catch (error) {
            console.error('Admin API Error (deleteProduct):', error)
            return { success: false, error: error.message }
        }
    },

    // --- LOGS ---

    /**
     * Registrar acción en logs
     */
    async logAction(adminId, businessId, action, details = {}) {
        try {
            // Si no se pasa adminId, intentar obtenerlo del usuario actual
            let finalAdminId = adminId
            if (!finalAdminId) {
                const { data: { user } } = await supabase.auth.getUser()
                finalAdminId = user?.id
            }

            const { error } = await supabase
                .from('admin_logs')
                .insert([{
                    admin_id: finalAdminId,
                    business_id: businessId,
                    action,
                    details
                }])

            if (error) console.error('Error logging action:', error)
        } catch (e) {
            console.error('Error in logAction:', e)
        }
    },

    /**
     * Obtener logs
     */
    async getLogs(limit = 50) {
        try {
            const { data, error } = await supabase
                .from('admin_logs')
                .select(`
          *,
          businesses(name),
          admin_users:admin_id(email) 
        `)
            // Nota: admin_users asume que admin_id es FK a auth.users, 
            // pero Supabase no permite joins directos a auth.users por seguridad desde el cliente 
            // a menos que se exponga una vista o se use una función. 
            // Por simplicidad, aquí solo obtenemos el log y luego podemos resolver nombres si es crítico.
            // O mejor: si admin_id apunta a auth.users, el join fallará si no hay permisos.
            // Simplificaremos a obtener solo datos de la tabla logs y business.

            const { data: simpleData, error: simpleError } = await supabase
                .from('admin_logs')
                .select('*, businesses(name)')
                .order('created_at', { ascending: false })
                .limit(limit)

            if (simpleError) throw simpleError
            return { success: true, data: simpleData }
        } catch (error) {
            console.error('Admin API Error (getLogs):', error)
            return { success: false, error: error.message }
        }
    },

    // --- CATEGORÍAS ---

    async getCategories(businessId) {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .eq('business_id', businessId)
                .order('name')

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Error fetching categories:', error)
            return { success: false, error: error.message }
        }
    },

    async createCategory(businessId, name) {
        try {
            const { data, error } = await supabase
                .from('categories')
                .insert([{ business_id: businessId, name }])
                .select()
                .single()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Error creating category:', error)
            return { success: false, error: error.message }
        }
    },

    // --- STORAGE ---

    async uploadImage(path, blob) {
        try {
            // 1. Upload
            const { data, error } = await supabase.storage
                .from('product-images')
                .upload(path, blob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: blob.type
                })

            if (error) throw error

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(path)

            return { success: true, data: { ...data, publicUrl } }

        } catch (error) {
            console.error('Storage Upload Error:', error)
            return { success: false, error: error.message }
        }
    },

    async uploadLogo(path, blob) {
        try {
            // 1. Upload
            const { data, error } = await supabase.storage
                .from('negocios-logos')
                .upload(path, blob, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: blob.type
                })

            if (error) throw error

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('negocios-logos')
                .getPublicUrl(path)

            return { success: true, data: { ...data, publicUrl } }
        } catch (error) {
            console.error('Logo Upload Error:', error)
            return { success: false, error: error.message }
        }
    }
}
