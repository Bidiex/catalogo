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
      if (optionData.type === 'quick_comment') {
        optionData.price = 0
      }
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
      if (optionData.type === 'quick_comment') {
        optionData.price = 0
      }
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
  },

  // ==========================================
  // GRUPOS DE OPCIONES
  // ==========================================

  /**
   * Obtener grupos globales por negocio
   */
  async getGroupsByBusiness(businessId) {
    try {
      const { data: groups, error: groupsError } = await supabase
        .from('product_option_groups')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

      if (groupsError) throw groupsError

      const groupIds = groups.map(g => g.id)
      if (groupIds.length === 0) return []

      const { data: options, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .in('group_id', groupIds)
        .order('display_order', { ascending: true })

      if (optionsError) throw optionsError

      return groups.map(group => ({
        ...group,
        options: options.filter(opt => opt.group_id == group.id)
      }))
    } catch (error) {
      console.error('Error getting business option groups:', error)
      throw error
    }
  },

  /**
   * Obtener grupos de un producto (vía asignaciones) con sus opciones
   */
  async getGroupsByProduct(productId) {
    try {
      // 1. Obtener assignments y grupos asociados
      const { data: assignments, error: assignError } = await supabase
        .from('product_option_group_assignments')
        .select(`
          display_order,
          group_id,
          product_option_groups (*)
        `)
        .eq('product_id', productId)
        .order('display_order', { ascending: true })

      if (assignError) throw assignError

      if (!assignments || assignments.length === 0) return []

      const groups = assignments.map(a => ({
        ...a.product_option_groups,
        display_order: a.display_order // Use the assignment's display order
      }))

      const groupIds = groups.map(g => g.id)

      // 2. Obtener opciones de esos grupos
      const { data: options, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .in('group_id', groupIds)
        .order('display_order', { ascending: true })

      if (optionsError) throw optionsError

      // 3. Estructurar respuesta
      return groups.map(group => ({
        ...group,
        options: options.filter(opt => opt.group_id == group.id)
      }))
    } catch (error) {
      console.error('Error getting product option groups:', error)
      throw error
    }
  },

  /**
   * Crear grupo de opciones
   */
  async createGroup(groupData) {
    try {
      const { data, error } = await supabase
        .from('product_option_groups')
        .insert([groupData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating group:', error)
      throw error
    }
  },

  /**
   * Actualizar grupo de opciones
   */
  async updateGroup(groupId, groupData) {
    try {
      const { data, error } = await supabase
        .from('product_option_groups')
        .update(groupData)
        .eq('id', groupId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating group:', error)
      throw error
    }
  },

  /**
   * Eliminar grupo de opciones
   */
  async deleteGroup(groupId) {
    try {
      const { error } = await supabase
        .from('product_option_groups')
        .delete()
        .eq('id', groupId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting group:', error)
      throw error
    }
  },

  /**
   * Asignar grupo a producto
   */
  async assignGroupToProduct(productId, groupId) {
    try {
      const { error } = await supabase
        .from('product_option_group_assignments')
        .insert([{ product_id: productId, group_id: groupId }])
      if (error && error.code !== '23505') throw error // Ignorar unique constraint
      return true
    } catch (error) {
      console.error('Error assigning group:', error)
      throw error
    }
  },

  /**
   * Desasignar grupo de producto
   */
  async unassignGroupFromProduct(productId, groupId) {
    try {
      const { error } = await supabase
        .from('product_option_group_assignments')
        .delete()
        .match({ product_id: productId, group_id: groupId })
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error unassigning group:', error)
      throw error
    }
  }
}