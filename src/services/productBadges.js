import { supabase } from '../config/supabase.js'

export const productBadgesService = {
  /**
   * Obtener badges de un negocio
   */
  async getByBusiness(businessId) {
    try {
      const { data, error } = await supabase
        .from('product_badges')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting badges:', error)
      throw error
    }
  },

  /**
   * Crear badge
   */
  async create({ business_id, name, color }) {
    try {
      const { data, error } = await supabase
        .from('product_badges')
        .insert({ business_id, name, color })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating badge:', error)
      throw error
    }
  },

  /**
   * Actualizar badge
   */
  async update(badgeId, { name, color }) {
    try {
      const { data, error } = await supabase
        .from('product_badges')
        .update({ name, color })
        .eq('id', badgeId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating badge:', error)
      throw error
    }
  },

  /**
   * Eliminar badge
   */
  async delete(badgeId) {
    try {
      const { error } = await supabase
        .from('product_badges')
        .delete()
        .eq('id', badgeId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting badge:', error)
      throw error
    }
  },

  /**
   * Obtener asignaciones de badges de un producto
   */
  async getAssignmentsByProduct(productId) {
    try {
      const { data, error } = await supabase
        .from('product_badge_assignments')
        .select('badge_id')
        .eq('product_id', productId)

      if (error) throw error
      return data.map(a => a.badge_id)
    } catch (error) {
      console.error('Error getting badge assignments:', error)
      throw error
    }
  },

  /**
   * Asignar badge a un producto
   */
  async assign(productId, badgeId) {
    try {
      const { error } = await supabase
        .from('product_badge_assignments')
        .insert([{ product_id: productId, badge_id: badgeId }])

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error assigning badge:', error)
      throw error
    }
  },

  /**
   * Quitar badge de un producto
   */
  async unassign(productId, badgeId) {
    try {
      const { error } = await supabase
        .from('product_badge_assignments')
        .delete()
        .eq('product_id', productId)
        .eq('badge_id', badgeId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error unassigning badge:', error)
      throw error
    }
  },

  /**
   * Obtener todos los badges y sus asignaciones para el catálogo
   */
  async getBadgesForCatalog(businessId) {
    try {
      const { data, error } = await supabase
        .from('product_badges')
        .select(`
          *,
          product_badge_assignments(product_id)
        `)
        .eq('business_id', businessId)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting badges for catalog:', error)
      throw error
    }
  }
}
