import { supabase } from '../config/supabase.js'

export const productService = {
  /**
   * Obtener productos de un negocio
   */
  async getByBusiness(businessId) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting products:', error)
      throw error
    }
  },

  /**
   * Obtener productos por categoría
   */
  async getByCategory(categoryId) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting products by category:', error)
      throw error
    }
  },

  /**
   * Crear producto
   */
  async create(productData) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  },

  /**
   * Actualizar producto
   */
  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', productId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  },

  /**
   * Eliminar producto
   */
  async delete(productId) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }
}