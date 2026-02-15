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
            // Generate slug from business name
            const slug = (businessData.name || '')
                .toLowerCase()
                .trim()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '')

            const { data, error } = await supabase
                .from('businesses')
                .insert([{
                    user_id: userId,
                    name: businessData.name,
                    slug,
                    whatsapp_number: businessData.phone,
                    description: businessData.description,
                    plan_type: 'plus', // Default to Plus
                    is_active: businessData.is_active !== undefined ? businessData.is_active : true,
                    plan_expires_at: businessData.plan_expires_at,
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
            // Only allow columns that exist in the businesses table
            const allowedColumns = [
                'name', 'slug', 'description', 'whatsapp_number', 'phone',
                'address', 'logo_url', 'plan_type', 'is_active',
                'plan_expires_at', 'plan_renewed_at', 'monthly_orders_count',
                'admin_notes'
            ]

            const cleanUpdates = {}
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined && allowedColumns.includes(key)) {
                    cleanUpdates[key] = value
                }
            }

            if (Object.keys(cleanUpdates).length === 0) {
                return { success: false, error: 'No valid fields to update' }
            }

            const { data, error } = await supabase
                .from('businesses')
                .update(cleanUpdates)
                .eq('id', businessId)
                .select()
                .single()

            if (error) throw error

            // Log automático
            await this.logAction(null, businessId, 'UPDATE_BUSINESS', { updates: cleanUpdates })

            return { success: true, data }
        } catch (error) {
            console.error('Admin API Error (updateBusiness):', error.message, error.details || '', error.hint || '')
            return { success: false, error: error.message }
        }
    },

    /**
     * Extender Plan (Fair Extension Logic)
     */
    async extendBusinessPlan(businessId) {
        try {
            // 1. Get current status to calculate logic
            const { data: business, error: fetchError } = await supabase
                .from('businesses')
                .select('plan_expires_at, monthly_orders_count')
                .eq('id', businessId)
                .single()

            if (fetchError) throw fetchError

            // 2. Calculate new Dates
            const now = new Date()
            const currentExpiry = new Date(business.plan_expires_at || now)

            // If expired, start from now. If active, add to existing expiry.
            const baseDate = currentExpiry > now ? currentExpiry : now

            const newExpiry = new Date(baseDate)
            newExpiry.setDate(newExpiry.getDate() + 30)

            // 3. Calculate Fair Order Rollover (Negative Counter)
            // Standard monthly limit is 300.
            // Remaining from current cycle = 300 - current_usage
            // If current usage is negative (already has rollover), math still works: 300 - (-50) = 350 remaining?
            // No, if I extend NOW, I want to keep the remaining capacity and add 300 more for the new month?
            // "si le faltan 10 días ... y 100 pedidos ... el nuevo periodo ... debe ser 400"
            // This implies we are resetting the cycle NOW or extending the cycle?
            // "Extender Trial 30 días" acts like adding a month.
            // If we just add 30 days to the expiry date, the `monthly_orders_count` logic in `business.js` 
            // depends on `plan_renewed_at`.
            // `business.js` logic: `remaining = 300 - current`.
            // We need to manipulate `monthly_orders_count` so that `300 - new_count = old_remaining + 300`.
            // `300 - new_count = (300 - old_count) + 300`
            // `300 - new_count = 600 - old_count`
            // `-new_count = 300 - old_count`
            // `new_count = old_count - 300`

            // Example: Used 200 (100 remaining).
            // old_count = 200.
            // new_count = 200 - 300 = -100.
            // Verify: `remaining = 300 - (-100) = 400`. Correct.

            // Example 2: Used 0 (300 remaining).
            // new_count = 0 - 300 = -300.
            // Verify: `remaining = 300 - (-300) = 600`. Correct.

            // Example 3: Used 350 (Over limit by 50).
            // old_count = 350.
            // new_count = 350 - 300 = 50.
            // Verify: `remaining = 300 - 50 = 250`. 
            // User pays for next month, but pays "debt" of 50?
            // Usually simple logic matches this. 
            // Unless we want to cap rollover? "no robarle". User didn't say forgive debt.
            // So this formula `new_count = old_count - 300` seems robust for fair extension.

            const currentCount = business.monthly_orders_count || 0
            const newCount = currentCount - 300

            // 4. Update
            const updates = {
                plan_expires_at: newExpiry.toISOString(),
                monthly_orders_count: newCount,
                is_active: true,
                // We do NOT update plan_renewed_at because we are just extending the Current cycle?
                // If we don't update renewed_at, `business.js` keeps strict 30 days check?
                // `business.js` uses `plan_renewed_at` mainly for display (cycleStart).
                // It does not enforce specific date checks for limit, just `isPlanExpired`.
                // So keeping `plan_renewed_at` is fine, or update it if we consider this a "Renewal".
                // But if we extend, effectively the cycle gets longer.
                // Let's leave `plan_renewed_at` as is, so it shows the start of this long "mega cycle"?
                // Or update it to now? If update to now, and we set count to -100,
                // UI says: Cycle Start: Now. Limit: 400. Used: 0.
                // If we leave it: Cycle Start: 20 days ago. Limit: 400. Used: 0.
                // Logic holds.
            }

            const { data, error } = await supabase
                .from('businesses')
                .update(updates)
                .eq('id', businessId)
                .select()
                .single()

            if (error) throw error

            await this.logAction(null, businessId, 'EXTEND_PLAN_FAIR', {
                added_days: 30,
                new_expiry: newExpiry.toISOString(),
                old_count: currentCount,
                new_count: newCount
            })

            return { success: true, data }

        } catch (error) {
            console.error('Admin API Error (extendBusinessPlan):', error)
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
