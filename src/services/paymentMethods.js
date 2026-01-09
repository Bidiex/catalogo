import { supabase } from '../config/supabase.js'

export const paymentMethodsService = {
  /**
   * Obtener métodos de pago de un negocio
   */
  async getByBusiness(businessId) {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting payment methods:', error)
      throw error
    }
  },

  /**
   * Crear método de pago
   */
  async create(paymentMethodData) {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .insert([paymentMethodData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating payment method:', error)
      throw error
    }
  },

  /**
   * Actualizar método de pago
   */
  async update(id, paymentMethodData) {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .update(paymentMethodData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating payment method:', error)
      throw error
    }
  },

  /**
   * Eliminar método de pago
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting payment method:', error)
      throw error
    }
  }
}
