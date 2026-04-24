import { supabase } from '../config/supabase.js'

export const announcementsService = {
  async getByBusiness(businessId) {
    const { data, error } = await supabase
      .from('catalog_announcements')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async getActive(businessId) {
    const { data, error } = await supabase
      .from('catalog_announcements')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) throw error
    return data
  },

  async create(announcementData) {
    const { data, error } = await supabase
      .from('catalog_announcements')
      .insert([announcementData])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id, announcementData) {
    const { data, error } = await supabase
      .from('catalog_announcements')
      .update(announcementData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id) {
    const { error } = await supabase
      .from('catalog_announcements')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  async deactivateAllOther(businessId, currentId) {
    const { error } = await supabase
      .from('catalog_announcements')
      .update({ is_active: false })
      .eq('business_id', businessId)
      .neq('id', currentId)

    if (error) throw error
    return true
  }
}
