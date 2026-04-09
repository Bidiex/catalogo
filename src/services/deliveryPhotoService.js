import { supabase } from '../config/supabase.js'

export const deliveryPhotoService = {
    /**
     * Sube un blob optimizado a Supabase Storage.
     * @param {string} businessId 
     * @param {string} orderId 
     * @param {Blob} blob 
     * @returns {Promise<{path: string}|{error: Error}>}
     */
    async uploadDeliveryPhoto(businessId, orderId, blob) {
        try {
            const path = `${businessId}/${orderId}/delivery_${Date.now()}.jpg`

            const { data, error } = await supabase.storage
                .from('delivery-photos')
                .upload(path, blob, {
                    cacheControl: '3600',
                    upsert: false // Fallaría si hay una subida simultánea exacta (poco probable por timestamp)
                })

            if (error) throw error

            return { path: data.path }
        } catch (error) {
            console.error('deliveryPhotoService.uploadDeliveryPhoto error:', error)
            return { error }
        }
    },

    /**
     * Llama a la RPC para persistir el path de la foto en el pedido.
     * @param {string} orderId 
     * @param {string} path 
     * @param {string} delivererId 
     * @returns {Promise<{success: boolean}|{error: Error}>}
     */
    async saveDeliveryPhotoPath(orderId, path, delivererId) {
        try {
            const { data, error } = await supabase.rpc('set_delivery_photo', {
                p_order_id: orderId,
                p_photo_url: path,
                p_deliverer_id: delivererId
            })

            if (error) throw error

            if (!data) {
                // RPC returned false
                throw new Error('No se pudo guardar la foto. El pedido podría no estar asignado a ti.')
            }

            return { success: true }
        } catch (error) {
            console.error('deliveryPhotoService.saveDeliveryPhotoPath error:', error)
            return { error }
        }
    },

    /**
     * Genera una URL firmada temporal (1h) para visualizar la foto en el panel admin.
     * @param {string} path 
     * @returns {Promise<{signedUrl: string}|{error: Error}>}
     */
    async getSignedPhotoUrl(path) {
        try {
            const { data, error } = await supabase.storage
                .from('delivery-photos')
                .createSignedUrl(path, 3600) // 1 hour expiration

            if (error) throw error

            return { signedUrl: data.signedUrl }
        } catch (error) {
            console.error('deliveryPhotoService.getSignedPhotoUrl error:', error)
            return { error }
        }
    }
}
