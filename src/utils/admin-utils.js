export const adminUtils = {
    /**
     * Formatear fecha a formato legible (DD/MM/YYYY HH:MM)
     */
    formatDate(dateString) {
        if (!dateString) return '-'
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date)
    },

    /**
     * Calcular días restantes desde hoy hasta fecha futura
     */
    getDaysRemaining(dateString) {
        if (!dateString) return 0
        const now = new Date()
        const future = new Date(dateString)
        const diffTime = future - now
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    },

    /**
     * Obtener color de estado para badges
     */
    getStatusColor(isActive) {
        return isActive ? 'success' : 'danger'
    },

    /**
     * Validar email con regex simple
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return re.test(email)
    },

    /**
     * Debounce function para búsquedas
     */
    debounce(func, wait) {
        let timeout
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout)
                func(...args)
            }
            clearTimeout(timeout)
            timeout = setTimeout(later, wait)
        }
    }
}
