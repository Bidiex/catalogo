import { supabase } from '../config/supabase.js'

export const linksService = {
    /**
     * Obtiene la página de enlaces y sus ítems para un negocio.
     * @param {string} businessId 
     */
    async getLinkPage(businessId) {
        try {
            // 1. Obtener la página del negocio
            let { data: page, error } = await supabase
                .from('link_pages')
                .select('*')
                .eq('business_id', businessId)
                .maybeSingle()

            if (error) throw error

            // Si no existe, retornamos null (el frontend decidirá si crearla o mostrar estado vacío)
            if (!page) return null

            // 2. Obtener los ítems ordenados
            const { data: items, error: itemsError } = await supabase
                .from('link_page_items')
                .select('*')
                .eq('link_page_id', page.id)
                .order('position', { ascending: true })

            if (itemsError) throw itemsError

            return {
                ...page,
                items: items || []
            }
        } catch (error) {
            console.error('Error getting link page:', error)
            throw error
        }
    },

    /**
     * Crea o actualiza la configuración de la página de enlaces.
     * @param {string} businessId 
     * @param {Object} data - { button_style, is_published, ... }
     */
    async upsertLinkPage(businessId, data) {
        try {
            // Verificar si ya existe
            const { data: existing } = await supabase
                .from('link_pages')
                .select('id')
                .eq('business_id', businessId)
                .maybeSingle()

            let result
            if (existing) {
                // Update
                const { data: updated, error } = await supabase
                    .from('link_pages')
                    .update({
                        ...data,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single()

                if (error) throw error
                result = updated
            } else {
                // Insert
                const { data: created, error } = await supabase
                    .from('link_pages')
                    .insert([{
                        business_id: businessId,
                        ...data
                    }])
                    .select()
                    .single()

                if (error) throw error
                result = created
            }

            return result
        } catch (error) {
            console.error('Error upserting link page:', error)
            throw error
        }
    },

    /**
     * Obtiene los ítems de una página de enlaces.
     * @param {string} linkPageId
     */
    async getLinkItems(linkPageId) {
        try {
            const { data, error } = await supabase
                .from('link_page_items')
                .select('*')
                .eq('link_page_id', linkPageId)
                .order('position', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting link items:', error)
            throw error
        }
    },

    /**
     * Añade un nuevo ítem a la página.
     * @param {string} linkPageId 
     * @param {Object} item - { label, url, position, ... }
     */
    async addLinkItem(linkPageId, item) {
        try {
            const { data, error } = await supabase
                .from('link_page_items')
                .insert([{
                    link_page_id: linkPageId,
                    button_style: item.button_style || 'semi-rounded',
                    ...item
                }])
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error adding link item:', error)
            throw error
        }
    },

    /**
     * Actualiza un ítem existente.
     * @param {string} itemId 
     * @param {Object} changes 
     */
    async updateLinkItem(itemId, changes) {
        try {
            const { data, error } = await supabase
                .from('link_page_items')
                .update({
                    ...changes,
                    updated_at: new Date().toISOString() // Ensure updated_at is refreshed if exists, or just valid SQL
                })
                .eq('id', itemId)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating link item:', error)
            throw error
        }
    },

    /**
     * Elimina un ítem (si es eliminable).
     * @param {string} itemId 
     */
    async deleteLinkItem(itemId) {
        try {
            // Primero verificar si es eliminable para mayor seguridad backend
            const { data: item } = await supabase
                .from('link_page_items')
                .select('is_deletable')
                .eq('id', itemId)
                .single()

            if (!item) throw new Error('Item not found')
            if (item.is_deletable === false) throw new Error('Este ítem no se puede eliminar')

            const { error } = await supabase
                .from('link_page_items')
                .delete()
                .eq('id', itemId)

            if (error) throw error
            return true
        } catch (error) {
            console.error('Error deleting link item:', error)
            throw error
        }
    },

    /**
     * Reordena los ítems actualizando sus posiciones.
     * @param {Array} items - Array de objetos con { id, position }
     */
    async reorderItems(items) {
        try {
            const updates = items.map(item => ({
                id: item.id,
                position: item.position,
                updated_at: new Date().toISOString() // Si tuviéramos updated_at en items
            }))

            // Supabase no tiene updateMany nativo simple, hacemos un loop o upsert
            // Upsert requiere todos los campos obligatorios si es insert, pero aquí son updates.
            // La forma más segura es un loop de promesas.
            const promises = items.map(item =>
                supabase
                    .from('link_page_items')
                    .update({ position: item.position })
                    .eq('id', item.id)
            )

            await Promise.all(promises)
            return true
        } catch (error) {
            console.error('Error reordering items:', error)
            throw error
        }
    },

    /**
     * Inicializa el enlace del catálogo si no existe en la página.
     * @param {string} linkPageId 
     * @param {string} catalogUrl 
     */
    async initCatalogLink(linkPageId, catalogUrl) {
        try {
            // Verificar si ya existe el link del catálogo
            const { data: existing } = await supabase
                .from('link_page_items')
                .select('id')
                .eq('link_page_id', linkPageId)
                .eq('is_catalog_link', true)
                .maybeSingle()

            if (!existing) {
                // Crear el link del catálogo (posición 0 siempre)
                await this.addLinkItem(linkPageId, {
                    label: 'Ver Catálogo',
                    url: catalogUrl,
                    position: 0,
                    is_active: true,
                    is_catalog_link: true,
                    is_deletable: false
                })
            }
        } catch (error) {
            console.error('Error init catalog link:', error)
        }
    },

    /**
     * Obtiene la data pública de links por slug
     */
    async getPublicLinksBySlug(slug) {
        try {
            // 1. Obtener business id por slug
            const { data: business, error: busError } = await supabase
                .from('businesses')
                .select('id, name, logo_url, slug')
                .eq('slug', slug)
                .maybeSingle()

            if (busError || !business) return null

            // 2. Obtener página
            const { data: page, error: pageError } = await supabase
                .from('link_pages')
                .select('*')
                .eq('business_id', business.id)
                .eq('is_published', true)
                .maybeSingle()

            if (pageError || !page) return null

            // 3. Obtener items activos
            const { data: items, error: itemsError } = await supabase
                .from('link_page_items')
                .select('*')
                .eq('link_page_id', page.id)
                .eq('is_active', true)
                .order('position', { ascending: true })

            return {
                business,
                page,
                items: items || []
            }
        } catch (error) {
            console.error('Error public links:', error)
            return null
        }
    },

    /**
     * Sube una imagen de fondo para la página de enlaces
     * @param {File} file 
     */
    async uploadBackgroundImage(file) {
        try {
            // Validar archivo
            if (!file) throw new Error('No se proporcionó archivo')

            // Validar tipo
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
            if (!validTypes.includes(file.type)) {
                throw new Error('Formato no válido. Usa JPG, PNG o WEBP')
            }

            // Validar tamaño (máx 5MB)
            if (file.size > 5 * 1024 * 1024) throw new Error('La imagen es muy grande. Máximo 5MB')

            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) throw new Error('Usuario no autenticado')

            const fileExt = file.name.split('.').pop()
            const fileName = `bg-${Date.now()}.${fileExt}`
            // Usaremos el bucket 'business-assets' si existe, o 'product-images' como fallback seguro por ahora
            // La instrucción no especificó bucket, usaremos 'product-images' en carpeta 'backgrounds' para consistencia con permisos existentes probables
            const filePath = `${user.id}/backgrounds/${fileName}`

            const { data, error } = await supabase.storage
                .from('product-images')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (error) throw error

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath)

            return { success: true, url: publicUrl }

        } catch (error) {
            console.error('Error uploading background:', error)
            throw error
        }
    }
}
