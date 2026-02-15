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
    },

    /**
     * Mostrar Toast Notification
     */
    showToast(message, type = 'success') {
        // Create container if not exists
        let container = document.getElementById('toast-container')
        if (!container) {
            container = document.createElement('div')
            container.id = 'toast-container'
            container.style.cssText = `
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            `
            document.body.appendChild(container)
        }

        // Create toaster
        const toast = document.createElement('div')
        const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'

        toast.style.cssText = `
            background-color: ${bgColor};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 300px;
            transform: translateX(100%);
            transition: transform 0.3s ease-out;
            font-size: 0.875rem;
            font-weight: 500;
        `

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `

        container.appendChild(toast)

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)'
        })

        // Remove after 3s
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)'
            setTimeout(() => {
                toast.remove()
                if (container.children.length === 0) {
                    container.remove()
                }
            }, 300)
        }, 3000)
    }
}
