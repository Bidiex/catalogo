import { supabase } from '../config/supabase.js'

export const categoryService = {
  /**
   * Obtener todas las categorías de un negocio
   */
  async getByBusiness(businessId) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting categories:', error)
      throw error
    }
  },

  /**
   * Crear categoría
   */
  async create(categoryData) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([categoryData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating category:', error)
      throw error
    }
  },

  /**
   * Actualizar categoría
   */
  async update(categoryId, categoryData) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', categoryId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  },

  /**
   * Eliminar categoría
   */
  async delete(categoryId) {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  }
}