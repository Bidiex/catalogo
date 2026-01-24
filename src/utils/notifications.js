/**
 * Sistema de notificaciones toast
 */

class NotificationManager {
  constructor() {
    this.container = null
    this.init()
  }

  init() {
    // Crear contenedor si no existe
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div')
      this.container.id = 'toast-container'
      this.container.className = 'toast-container'
      document.body.appendChild(this.container)
    } else {
      this.container = document.getElementById('toast-container')
    }
  }

  /**
   * Mostrar notificación
   */
  show(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`

    // Icono según el tipo
    const icons = {
      success: 'ri-checkbox-circle-line',
      error: 'ri-error-warning-line',
      warning: 'ri-alert-line',
      info: 'ri-information-line'
    }

    toast.innerHTML = `
      <div class="toast-icon">
        <i class="${icons[type]}"></i>
      </div>
      <div class="toast-content">
        <p class="toast-message">${message}</p>
      </div>
      <button class="toast-close">
        <i class="ri-close-line"></i>
      </button>
    `

    // Agregar al contenedor
    this.container.appendChild(toast)

    // Animar entrada
    setTimeout(() => {
      toast.classList.add('toast-show')
    }, 10)

    // Botón cerrar
    const closeBtn = toast.querySelector('.toast-close')
    closeBtn.addEventListener('click', () => {
      this.remove(toast)
    })

    // Auto-remover después de la duración
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast)
      }, duration)
    }

    return toast
  }

  /**
   * Remover notificación
   */
  remove(toast) {
    toast.classList.remove('toast-show')
    toast.classList.add('toast-hide')

    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast)
      }
    }, 300)
  }

  /**
   * Atajos para diferentes tipos
   */
  success(message, duration) {
    return this.show(message, 'success', duration)
  }

  error(message, duration) {
    return this.show(message, 'error', duration)
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration)
  }

  info(message, duration) {
    return this.show(message, 'info', duration)
  }

  /**
   * Notificación de carga (sin auto-cerrar)
   */
  loading(message) {
    const toast = this.show(message, 'info', 0)
    toast.classList.add('toast-loading')

    // Agregar spinner
    const icon = toast.querySelector('.toast-icon i')
    icon.className = 'ri-loader-4-line toast-spinner'

    return toast
  }

  /**
   * Actualizar notificación de carga a éxito/error
   */
  updateLoading(toast, message, type = 'success') {
    const icon = toast.querySelector('.toast-icon i')
    const messageEl = toast.querySelector('.toast-message')

    toast.className = `toast toast-${type} toast-show`
    messageEl.textContent = message

    const icons = {
      success: 'ri-checkbox-circle-line',
      error: 'ri-error-warning-line'
    }

    icon.className = icons[type]

    // Auto-cerrar después de 3 segundos
    setTimeout(() => {
      this.remove(toast)
    }, 3000)
  }

  /**
   * Limpiar todas las notificaciones
   */
  clearAll() {
    const toasts = this.container.querySelectorAll('.toast')
    toasts.forEach(toast => this.remove(toast))
  }
}

// Exportar instancia única
export const notify = new NotificationManager()

/**
 * Sistema de diálogos de confirmación
 */
class ConfirmDialog {
  constructor() {
    this.modal = null
    this.resolvePromise = null
  }

  /**
   * Mostrar diálogo de confirmación
   */
  show({
    title = '¿Estás seguro?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger' // 'danger', 'warning', 'info'
  }) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve
      this.render({ title, message, confirmText, cancelText, type })
    })
  }

  render({ title, message, confirmText, cancelText, type }) {
    // Crear modal si no existe
    if (!this.modal) {
      this.modal = document.createElement('div')
      this.modal.className = 'confirm-modal'
      document.body.appendChild(this.modal)
    }

    // Iconos según el tipo
    const icons = {
      danger: 'ri-error-warning-line',
      warning: 'ri-alert-line',
      info: 'ri-information-line',
      success: 'ri-checkbox-circle-line'
    }

    const colors = {
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    }

    this.modal.innerHTML = `
      <div class="confirm-overlay"></div>
      <div class="confirm-content">
        <div class="confirm-icon confirm-icon-${type}">
          <i class="${icons[type]}"></i>
        </div>
        <h3 class="confirm-title">${title}</h3>
        ${message ? `<p class="confirm-message">${message}</p>` : ''}
        <div class="confirm-actions">
          <button class="btn-confirm-cancel">${cancelText}</button>
          <button class="btn-confirm-ok btn-confirm-${type}">${confirmText}</button>
        </div>
      </div>
    `

    this.modal.style.display = 'flex'

    // Animar entrada
    setTimeout(() => {
      this.modal.classList.add('confirm-show')
    }, 10)

    // Event listeners
    const overlay = this.modal.querySelector('.confirm-overlay')
    const cancelBtn = this.modal.querySelector('.btn-confirm-cancel')
    const okBtn = this.modal.querySelector('.btn-confirm-ok')

    overlay.addEventListener('click', () => this.close(false))
    cancelBtn.addEventListener('click', () => this.close(false))
    okBtn.addEventListener('click', () => this.close(true))

    // ESC para cerrar
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close(false)
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)
  }

  close(result) {
    this.modal.classList.remove('confirm-show')

    setTimeout(() => {
      this.modal.style.display = 'none'
      if (this.resolvePromise) {
        this.resolvePromise(result)
        this.resolvePromise = null
      }
    }, 200)
  }
}

// Exportar instancia única
export const confirm = new ConfirmDialog()