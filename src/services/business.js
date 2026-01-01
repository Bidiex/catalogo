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
    return name
      .toLowerCase()
      .trim()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
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