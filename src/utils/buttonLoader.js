/**
 * Utilidad para gestionar estados de carga en botones
 */

export const buttonLoader = {
  /**
   * Activar estado de carga en un botón
   */
  start(button, loadingText = 'Cargando...') {
    if (!button) return

    // Guardar texto original
    button.dataset.originalText = button.innerHTML
    button.dataset.originalDisabled = button.disabled

    // Deshabilitar y cambiar texto
    button.disabled = true
    button.classList.add('btn-loading')
    
    // Agregar spinner
    button.innerHTML = `
      <i class="ri-loader-4-line btn-spinner"></i>
      <span>${loadingText}</span>
    `
  },

  /**
   * Desactivar estado de carga en un botón
   */
  stop(button) {
    if (!button) return

    // Restaurar estado original
    const originalText = button.dataset.originalText
    const originalDisabled = button.dataset.originalDisabled === 'true'

    if (originalText) {
      button.innerHTML = originalText
    }

    button.disabled = originalDisabled
    button.classList.remove('btn-loading')

    // Limpiar dataset
    delete button.dataset.originalText
    delete button.dataset.originalDisabled
  },

  /**
   * Ejecutar función con estado de carga
   */
  async execute(button, asyncFn, loadingText) {
    try {
      this.start(button, loadingText)
      return await asyncFn()
    } finally {
      this.stop(button)
    }
  }
}