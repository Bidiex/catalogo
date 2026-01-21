/**
 * Utilidad para manejar el carrito de compras
 * Usa localStorage para persistencia entre sesiones
 * Ahora aislado por businessId
 */

export const cart = {
  /**
   * Generar clave de localStorage basada en businessId
   */
  getKey(businessId) {
    if (!businessId) {
      console.warn('Cart: No businessId provided, using temp cart')
      return 'catalog_cart_temp'
    }
    return `catalog_cart_${businessId}`
  },

  /**
   * Obtener items del carrito
   */
  get(businessId) {
    try {
      const key = this.getKey(businessId)
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error getting cart:', error)
      return []
    }
  },

  /**
   * Guardar carrito en localStorage
   */
  save(businessId, items) {
    try {
      const key = this.getKey(businessId)
      localStorage.setItem(key, JSON.stringify(items))
    } catch (error) {
      console.error('Error saving cart:', error)
    }
  },

  /**
   * Agregar producto al carrito con opciones
   */
  add(businessId, product, quantity = 1, options = { quickComment: null, sides: [] }) {
    const items = this.get(businessId)

    // Generar ID único para el item (producto + opciones)
    const itemKey = this.generateItemKey(product.id, options)
    const existingIndex = items.findIndex(item => item.itemKey === itemKey)

    if (existingIndex !== -1) {
      // Ya existe con las mismas opciones, incrementar cantidad
      items[existingIndex].quantity += quantity
    } else {
      // No existe, agregar nuevo
      items.push({
        itemKey,
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        is_promotion: product.is_promotion || false,
        quantity: quantity,
        options: options
      })
    }

    this.save(businessId, items)
    return items
  },

  /**
   * Generar clave única para item (producto + opciones)
   * NO requiere businessId ya que es interno del producto
   */
  generateItemKey(productId, options) {
    const quickComment = options.quickComment || ''
    const sides = (options.sides || []).sort().join(',')
    return `${productId}-${quickComment}-${sides}`
  },

  /**
   * Actualizar cantidad de un item
   */
  updateQuantity(businessId, itemKey, newQuantity) {
    const items = this.get(businessId)
    const item = items.find(i => i.itemKey === itemKey)

    if (item) {
      if (newQuantity <= 0) {
        return this.remove(businessId, itemKey)
      }
      item.quantity = newQuantity
      this.save(businessId, items)
    }

    return items
  },

  /**
   * Eliminar item del carrito
   */
  remove(businessId, itemKey) {
    const items = this.get(businessId).filter(item => item.itemKey !== itemKey)
    this.save(businessId, items)
    return items
  },

  /**
   * Limpiar todo el carrito
   */
  clear(businessId) {
    const key = this.getKey(businessId)
    localStorage.removeItem(key)
    return []
  },

  /**
   * Obtener cantidad total de items
   */
  getItemCount(businessId) {
    return this.get(businessId).reduce((sum, item) => sum + item.quantity, 0)
  },

  /**
   * Calcular total del carrito incluyendo opciones
   */
  getTotal(businessId) {
    return this.get(businessId).reduce((sum, item) => {
      let itemTotal = parseFloat(item.price) * item.quantity

      // Sumar precio de acompañantes
      if (item.options?.sides) {
        const sidesTotal = item.options.sides.reduce((sideSum, side) => {
          return sideSum + (parseFloat(side.price) || 0)
        }, 0)
        itemTotal += sidesTotal * item.quantity
      }

      return sum + itemTotal
    }, 0)
  }
}