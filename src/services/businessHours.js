import { supabase } from '../config/supabase.js'

export const businessHoursService = {
    /**
     * Obtener horarios de un negocio
     */
    async getByBusiness(businessId) {
        try {
            const { data, error } = await supabase
                .from('business_hours')
                .select('*')
                .eq('business_id', businessId)
                .order('day_of_week', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error getting business hours:', error)
            throw error
        }
    },

    /**
     * Crear o actualizar horarios (upsert)
     */
    async upsert(hoursData) {
        try {
            const { data, error } = await supabase
                .from('business_hours')
                .upsert(hoursData, {
                    onConflict: 'business_id,day_of_week'
                })
                .select()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error upserting business hours:', error)
            throw error
        }
    },

    /**
     * Verificar si el negocio está abierto en este momento
     */
    isBusinessOpen(businessHours) {
        const now = new Date()
        const currentDay = now.getDay() // 0 = Sunday, 6 = Saturday
        const currentTime = now.toTimeString().slice(0, 5) // "HH:MM"

        // Buscar horario del día actual
        const todayHours = businessHours.find(h => h.day_of_week === currentDay)

        if (!todayHours || !todayHours.is_open) {
            return {
                isOpen: false,
                message: 'Cerrado hoy'
            }
        }

        // Comparar hora actual con horarios
        if (currentTime >= todayHours.open_time && currentTime < todayHours.close_time) {
            return {
                isOpen: true,
                message: `Abierto hasta las ${todayHours.close_time}`
            }
        }

        return {
            isOpen: false,
            message: `Cerrado - Abre a las ${todayHours.open_time}`
        }
    },

    /**
     * Obtener próximo horario de apertura
     */
    getNextOpeningTime(businessHours) {
        const now = new Date()
        const currentDay = now.getDay()
        const currentTime = now.toTimeString().slice(0, 5)

        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

        // Buscar en los próximos 7 días
        for (let i = 0; i < 7; i++) {
            const checkDay = (currentDay + i) % 7
            const dayHours = businessHours.find(h => h.day_of_week === checkDay)

            if (dayHours && dayHours.is_open) {
                // Si es hoy y aún no ha abierto
                if (i === 0 && currentTime < dayHours.open_time) {
                    return `Hoy a las ${dayHours.open_time}`
                }
                // Si es otro día
                if (i > 0) {
                    return `${dayNames[checkDay]} a las ${dayHours.open_time}`
                }
            }
        }

        return 'Horario no disponible'
    }
}
