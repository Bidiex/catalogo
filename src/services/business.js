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

      // Calculate default plan expiration (30 days from now)
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          user_id: user.id,
          ...businessData,
          // Force defaults for new logic
          plan_type: 'plus',
          plan_expires_at: expiresAt.toISOString(),
          is_active: true,
          monthly_orders_count: 0,
          plan_renewed_at: now.toISOString()
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
  },

  /**
   * Check if business can create more orders (monthly limit for Plus plan)
   */
  async canCreateOrder(businessId) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('plan_type, monthly_orders_count, plan_renewed_at, plan_expires_at')
        .eq('id', businessId)
        .single()

      if (error) throw error

      // Check if plan expired
      const planExpired = this.isPlanExpired(business.plan_expires_at)

      if (planExpired) {
        return {
          allowed: false,
          reason: 'plan_expired',
          message: 'El plan ha expirado. Renueva para continuar recibiendo pedidos.'
        }
      }

      // Initialize plan_renewed_at for existing businesses (safe guard)
      if (!business.plan_renewed_at) {
        await this.initializePlanRenewal(businessId, business.plan_expires_at)
        // Recalculate basic
        const expiresDate = new Date(business.plan_expires_at)
        const renewedDate = new Date(expiresDate)
        renewedDate.setDate(renewedDate.getDate() - 30)
        business.plan_renewed_at = renewedDate.toISOString()
        business.monthly_orders_count = 0
      }

      // Check limit based on plan
      const plan = business.plan_type

      if (plan === 'pro') {
        return { allowed: true, unlimited: true }
      }

      if (plan === 'plus') {
        const current = business.monthly_orders_count || 0
        const baseLimit = 300

        // Handle negative counter (fair extension logic)
        // If current is -50, it means 50 carried over orders.
        // Effective remaining = 300 (base) + 50 (carried) = 350 - 0 (used since renewal?)
        // Actually, 'current' is the *net* usage.
        // So remaining = baseLimit - current.
        // E.g. 300 - (-50) = 350. Correct.

        return {
          allowed: current < baseLimit,
          current: current,
          limit: baseLimit,
          remaining: baseLimit - current,
          cycleStart: business.plan_renewed_at,
          cycleEnd: business.plan_expires_at
        }
      }

      return { allowed: false }
    } catch (error) {
      console.error('Error checking order limit:', error)
      return { allowed: false, error: error.message }
    }
  },

  /**
   * Check if plan is expired
   */
  isPlanExpired(planExpiresAt) {
    if (!planExpiresAt) return true
    const now = new Date()
    const expires = new Date(planExpiresAt)
    return now > expires
  },

  /**
   * Initialize plan_renewed_at for existing businesses
   */
  async initializePlanRenewal(businessId, planExpiresAt) {
    try {
      // Calculate plan_renewed_at as plan_expires_at - 30 days
      const expiresDate = new Date(planExpiresAt)
      const renewedDate = new Date(expiresDate)
      renewedDate.setDate(renewedDate.getDate() - 30)

      const { error } = await supabase
        .from('businesses')
        .update({
          plan_renewed_at: renewedDate.toISOString(),
          monthly_orders_count: 0
        })
        .eq('id', businessId)

      if (error) throw error
    } catch (error) {
      console.error('Error initializing plan renewal:', error)
      throw error
    }
  },

  /**
   * Renew plan (resets counter and updates dates)
   */
  async renewPlan(businessId, newPlanType = 'plus') {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days

      const { data, error } = await supabase
        .from('businesses')
        .update({
          plan_type: newPlanType,
          plan_renewed_at: now.toISOString(),
          plan_expires_at: expiresAt.toISOString(),
          monthly_orders_count: 0,
          is_active: true
        })
        .eq('id', businessId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error renewing plan:', error)
      throw error
    }
  },

  /**
   * Increment monthly orders counter
   */
  async incrementMonthlyOrders(businessId) {
    try {
      const { data, error } = await supabase.rpc('increment_monthly_orders', {
        business_id: businessId
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error incrementing monthly orders:', error)
      throw error
    }
  }
}