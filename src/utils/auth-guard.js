import { supabase } from '../config/supabase.js'

const CACHE_KEY = 'admin_sess_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const authGuard = {
    /**
     * Verificar si el usuario actual es superadmin
     * @returns {Promise<{isAdmin: boolean, role: string, userId: string|null}>}
     */
    async checkAdminSession() {
        try {
            // 1. Check if we have a valid cache
            const cached = this.getCache()
            if (cached) {
                return cached
            }

            // 2. Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                return { isAdmin: false, role: null, userId: null }
            }

            // 3. Query admin_roles table
            const { data, error } = await supabase
                .from('admin_roles')
                .select('role')
                .eq('user_id', user.id)
                .eq('role', 'superadmin')
                .maybeSingle()

            if (error && error.code !== 'PGRST116') {
                console.error('Error checking admin role:', error)
                return { isAdmin: false, role: null, userId: user.id }
            }

            const isAdmin = !!data
            const role = data?.role || null

            // 4. Set cache if admin
            if (isAdmin) {
                this.setCache({ isAdmin, role, userId: user.id })
            }

            return { isAdmin, role, userId: user.id }
        } catch (error) {
            console.error('Auth guard error:', error)
            return { isAdmin: false, role: null, userId: null }
        }
    },

    /**
     * Redirigir si no es admin
     * @param {string} redirectUrl - URL a redirigir si NO es admin (default: /login)
     */
    async requireAdmin(redirectUrl = '/login') {
        const { isAdmin } = await this.checkAdminSession()
        if (!isAdmin) {
            window.location.href = redirectUrl
            return false
        }
        return true
    },

    /**
     * Obtener cache válido
     */
    getCache() {
        try {
            const item = sessionStorage.getItem(CACHE_KEY)
            if (!item) return null

            const parsed = JSON.parse(item)
            const now = Date.now()

            if (now > parsed.expiresAt) {
                sessionStorage.removeItem(CACHE_KEY)
                return null
            }

            return parsed.data
        } catch (e) {
            return null
        }
    },

    /**
     * Guardar en cache
     */
    setCache(data) {
        const expiresAt = Date.now() + CACHE_TTL
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            expiresAt
        }))
    },

    /**
     * Limpiar cache
     */
    clearAdminCache() {
        sessionStorage.removeItem(CACHE_KEY)
    }
}
