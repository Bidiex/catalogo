import { planService } from '../services/plan.js'

/**
 * Utilitario para aplicar clases visuales de bloqueo a los elementos protegidos
 * por el sistema de planes (Plan Plus -> Features Pro).
 */
export const featureLocker = {
    /**
     * Recorre el contenedor en busca de elementos [data-feature]
     * y aplica o remueve el bloqueo visual según el plan.
     * 
     * @param {HTMLElement} container Elemento DOM padre para buscar. (por defecto document)
     */
    applyFeatureLocks(container = document) {
        const featureNodes = container.querySelectorAll('[data-feature]')

        featureNodes.forEach(node => {
            const featureName = node.getAttribute('data-feature')

            if (!planService.hasFeature(featureName)) {
                this.lockElement(node, featureName)
            } else {
                this.unlockElement(node)
            }
        })
    },

    /**
     * Aplica un tratamiento visual para bloquear un elemento sin ocultarlo.
     */
    lockElement(node, featureName) {
        // Evitar múltiples bindings o lockeos dobles
        if (node.classList.contains('feature--locked')) return

        node.classList.add('feature--locked')

        // Si queremos mostrar un badge o ícono
        const lockIcon = document.createElement('div')
        lockIcon.classList.add('feature-lock-badge')
        lockIcon.innerHTML = `<i class="ri-lock-star-line"></i> Pro`

        // Solo agregar el badge si el nodo no lo tiene y tiene posición relativa/absolute
        if (!node.querySelector('.feature-lock-badge')) {
            const computedStyle = window.getComputedStyle(node)
            if (computedStyle.position === 'static') {
                node.style.position = 'relative'
            }
            node.appendChild(lockIcon)
        }

        // Interceptar clicks en este elemento (capturing phase)
        node.addEventListener('click', this.handleLockedClick, true)
        node.dataset.lockedFeature = featureName
    },

    /**
     * Remueve el bloqueo visual de un elemento.
     */
    unlockElement(node) {
        node.classList.remove('feature--locked')

        const badge = node.querySelector('.feature-lock-badge')
        if (badge) {
            badge.remove()
        }

        node.removeEventListener('click', this.handleLockedClick, true)
        delete node.dataset.lockedFeature
    },

    /**
     * Manejador global para interceptar clicks en features bloqueadas.
     */
    handleLockedClick(e) {
        e.preventDefault()
        e.stopPropagation()

        // Disparar evento personalizado para que el modal/banner de Upgrade se muestre.
        // O si ya tenemos una referencia a la función de upgrade, llamarla.
        const featureName = e.currentTarget.dataset.lockedFeature
        const event = new CustomEvent('traego:upgrade-required', { detail: { featureName } })
        window.dispatchEvent(event)
    }
}
