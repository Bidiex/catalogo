/**
 * Utilidad para manejar favoritos de productos
 * Usa localStorage para persistencia y sincroniza con Supabase
 */

import { supabase } from '../config/supabase.js'

// Generar o recuperar session ID único para este dispositivo
function getOrCreateSessionId() {
    const SESSION_KEY = 'user_session_id'
    let sessionId = localStorage.getItem(SESSION_KEY)

    if (!sessionId) {
        // Generar UUID simple
        sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
        localStorage.setItem(SESSION_KEY, sessionId)
    }

    return sessionId
}

export const favorites = {
    /**
     * Obtener clave de localStorage para un negocio
     */
    getKey(businessId) {
        return `product_favorites_${businessId}`
    },

    /**
     * Obtener array de IDs de productos favoritos
     */
    get(businessId) {
        try {
            const key = this.getKey(businessId)
            const data = localStorage.getItem(key)
            return data ? JSON.parse(data) : []
        } catch (error) {
            console.error('Error getting favorites:', error)
            return []
        }
    },

    /**
     * Guardar favoritos en localStorage
     */
    save(businessId, favoriteIds) {
        try {
            const key = this.getKey(businessId)
            localStorage.setItem(key, JSON.stringify(favoriteIds))
        } catch (error) {
            console.error('Error saving favorites:', error)
        }
    },

    /**
     * Verificar si un producto está en favoritos
     */
    isFavorite(businessId, productId) {
        const favoriteIds = this.get(businessId)
        return favoriteIds.includes(productId)
    },

    /**
     * Añadir producto a favoritos
     */
    async add(businessId, productId) {
        const favoriteIds = this.get(businessId)

        if (!favoriteIds.includes(productId)) {
            favoriteIds.push(productId)
            this.save(businessId, favoriteIds)

            // Sincronizar con Supabase en background
            await this.syncWithSupabase(businessId, productId, 'add')
        }

        return favoriteIds
    },

    /**
     * Quitar producto de favoritos
     */
    async remove(businessId, productId) {
        let favoriteIds = this.get(businessId)
        favoriteIds = favoriteIds.filter(id => id !== productId)
        this.save(businessId, favoriteIds)

        // Sincronizar con Supabase en background
        await this.syncWithSupabase(businessId, productId, 'remove')

        return favoriteIds
    },

    /**
     * Toggle favorito (añadir o quitar)
     * Retorna true si ahora es favorito, false si no
     */
    async toggle(businessId, productId) {
        const isFav = this.isFavorite(businessId, productId)

        if (isFav) {
            await this.remove(businessId, productId)
            return false
        } else {
            await this.add(businessId, productId)
            return true
        }
    },

    /**
     * Limpiar todos los favoritos de un negocio
     */
    clear(businessId) {
        const key = this.getKey(businessId)
        localStorage.removeItem(key)
        return []
    },

    /**
     * Sincronizar con Supabase
     */
    async syncWithSupabase(businessId, productId, action) {
        try {
            const sessionId = getOrCreateSessionId()

            if (action === 'add') {
                // Insertar like en Supabase
                const { error } = await supabase
                    .from('product_likes')
                    .insert({
                        product_id: productId,
                        business_id: businessId,
                        session_id: sessionId
                    })

                if (error && error.code !== '23505') { // 23505 = unique violation (duplicate)
                    console.error('Error adding like to Supabase:', error)
                }
            } else if (action === 'remove') {
                // Eliminar like de Supabase
                const { error } = await supabase
                    .from('product_likes')
                    .delete()
                    .eq('product_id', productId)
                    .eq('session_id', sessionId)

                if (error) {
                    console.error('Error removing like from Supabase:', error)
                }
            }
        } catch (error) {
            // No bloquear la UI si falla la sincronización
            console.error('Error syncing with Supabase:', error)
        }
    }
}
