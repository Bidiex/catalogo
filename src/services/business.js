import { supabase } from '../config/supabase.js'

export const businessService = {
  /**
   * Obtener el negocio del usuario actual
   */
  async getMyBusiness() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated')

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // Si no existe el negocio, devolver null (no es error)
        if (error.code === 'PGRST116') return null
        throw error
      }

      return data
    } catch (error) {
      console.error('Error getting business:', error)
      throw error
    }
  },

  /**
   * Crear un negocio
   */
  async createBusiness(businessData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated')

      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          user_id: user.id,
          ...businessData
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating business:', error)
      throw error
    }
  },

  /**
   * Actualizar negocio
   */
  async updateBusiness(businessId, businessData) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .update(businessData)
        .eq('id', businessId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating business:', error)
      throw error
    }
  },

  /**
 * Generar slug único desde el nombre
 */
  generateSlug(name) {
    if (!name || typeof name !== 'string') {
      return ''
    }

    return name
      .toLowerCase()
      .trim()
      // Reemplazar caracteres acentuados
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Reemplazar caracteres especiales
      .replace(/[^a-z0-9\s-]/g, '')
      // Reemplazar espacios por guiones
      .replace(/\s+/g, '-')
      // Reemplazar múltiples guiones por uno solo
      .replace(/-+/g, '-')
      // Eliminar guiones al inicio y final
      .replace(/^-+|-+$/g, '')
  },

  /**
   * Verificar si un slug ya existe
   */
  async slugExists(slug) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .single()

      if (error && error.code === 'PGRST116') return false
      return !!data
    } catch (error) {
      console.error('Error checking slug:', error)
      return false
    }
  }
}