import { supabase } from '../config/supabase.js'

export const productOptionsService = {
  /**
   * Obtener opciones de un producto
   */
  async getByProduct(productId) {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting product options:', error)
      throw error
    }
  },

  /**
   * Obtener opciones por tipo
   */
  async getByType(productId, type) {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .eq('type', type)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting product options by type:', error)
      throw error
    }
  },

  /**
   * Crear opción
   */
  async create(optionData) {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .insert([optionData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating option:', error)
      throw error
    }
  },

  /**
   * Actualizar opción
   */
  async update(optionId, optionData) {
    try {
      const { data, error } = await supabase
        .from('product_options')
        .update(optionData)
        .eq('id', optionId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating option:', error)
      throw error
    }
  },

  /**
   * Eliminar opción
   */
  async delete(optionId) {
    try {
      const { error } = await supabase
        .from('product_options')
        .delete()
        .eq('id', optionId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting option:', error)
      throw error
    }
  }
}