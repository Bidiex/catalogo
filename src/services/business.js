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
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting business:', error)
      return null
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
  },

  /**
   * Check if business is operational (active AND active plan)
   * @param {Object} business 
   * @returns {boolean}
   */
  isOperational(business) {
    if (!business) return false

    // 1. Check if manually active
    if (business.is_active === false) return false

    // 2. Check if plan is expired
    const expiresAt = new Date(business.plan_expires_at)
    const now = new Date()

    if (now > expiresAt) return false

    return true
  },

  /**
   * Get formatting plan info
   */
  getPlanInfo(business) {
    if (!business) return null

    const now = new Date()
    const expiresAt = new Date(business.plan_expires_at)
    const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
    const isExpired = daysRemaining < 0

    return {
      type: business.plan_type || 'plus',
      expiresAt: expiresAt,
      daysRemaining: daysRemaining,
      isExpired: isExpired,
      label: (business.plan_type || 'plus').toUpperCase()
    }
  },

  /**
   * Get product limit for plan
   */
  getProductLimit(planType) {
    if (planType === 'pro') return Infinity
    return 50 // Plus limit
  },

  /**
   * Check if business can create more products
   */
  async canCreateProduct(businessId, planType) {
    const limit = this.getProductLimit(planType)

    // Always count current products to allow UI display
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)

    if (error) {
      console.error('Error counting products:', error)
      return { allowed: false, error, current: 0, limit }
    }

    if (planType === 'pro') {
      return { allowed: true, current: count, limit: Infinity }
    }

    return {
      allowed: count < limit,
      current: count,
      limit: limit
    }
  }
}