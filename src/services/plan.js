import { businessService } from './business.js'

/**
 * Módulo central para la gestión de funcionalidades por plan.
 * Toda validación de planes (Plus, Pro) debe pasar por aquí.
 */

// Mapa centralizado de qué funcionalidades corresponden a qué plan.
// Por defecto se asume que si no requiere 'pro', un 'plus' puede acceder a todo lo básico.
export const FEATURES_MAP = {
    'order-tracking': ['pro'],
    'order-suggestions': ['pro']
}

class PlanService {
    constructor() {
        this.currentPlan = null
    }

    /**
     * Inicializa el servicio cargando el plan actual.
     * Útil para llamarlo al cargar el dashboard.
     */
    init(business) {
        if (business && business.plan_type) {
            this.currentPlan = business.plan_type.toLowerCase()
        } else {
            this.currentPlan = 'plus' // Default si no se encuentra
        }
    }

    /**
     * Obtiene el plan activo síncronamente (debe haberse inicializado antes)
     */
    getCurrentPlan() {
        return this.currentPlan || 'plus'
    }

    /**
     * Recarga el plan del negocio actual de forma asíncrona desde base de datos
     */
    async reloadPlan() {
        try {
            const business = await businessService.getMyBusiness()
            this.init(business)
            return this.currentPlan
        } catch (error) {
            console.error('Error recargando el plan:', error)
            return 'plus'
        }
    }

    /**
     * Verifica si el negocio autenticado es Pro
     */
    isPro() {
        return this.getCurrentPlan() === 'pro'
    }

    /**
     * Verifica si el negocio autenticado es Plus
     */
    isPlus() {
        return this.getCurrentPlan() === 'plus'
    }

    /**
     * Verifica si el plan actual tiene acceso a una funcionalidad específica.
     */
    hasFeature(featureName) {
        const requiredPlans = FEATURES_MAP[featureName]

        // Si la feature no está registrada, asumimos que es base (Plus y Pro pueden verla)
        if (!requiredPlans) {
            return true
        }

        const currentPlan = this.getCurrentPlan()
        return requiredPlans.includes(currentPlan)
    }
}

export const planService = new PlanService()
