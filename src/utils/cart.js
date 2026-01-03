/**
 * Utilidad para manejar el carrito de compras
 * Usa localStorage para persistencia entre sesiones
 */

const CART_KEY = 'catalog_cart'

export const cart = {
  /**
   * Obtener items del carrito
   */
  get() {
    try {
      const data = localStorage.getItem(CART_KEY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error getting cart:', error)
      return []
    }
  },

  /**
   * Guardar carrito en localStorage
   */
  save(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    } catch (error) {
      console.error('Error saving cart:', error)
    }
  },

  /**
   * Agregar producto al carrito con opciones
   */
  add(product, quantity = 1, options = { quickComment: null, sides: [] }) {
    const items = this.get()
    
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
        quantity: quantity,
        options: options
      })
    }

    this.save(items)
    return items
  },

  /**
   * Generar clave única para item (producto + opciones)
   */
  generateItemKey(productId, options) {
    const quickComment = options.quickComment || ''
    const sides = (options.sides || []).sort().join(',')
    return `${productId}-${quickComment}-${sides}`
  },

  /**
   * Actualizar cantidad de un item
   */
  updateQuantity(itemKey, newQuantity) {
    const items = this.get()
    const item = items.find(i => i.itemKey === itemKey)

    if (item) {
      if (newQuantity <= 0) {
        return this.remove(itemKey)
      }
      item.quantity = newQuantity
      this.save(items)
    }

    return items
  },

  /**
   * Eliminar item del carrito
   */
  remove(itemKey) {
    const items = this.get().filter(item => item.itemKey !== itemKey)
    this.save(items)
    return items
  },

  /**
   * Limpiar todo el carrito
   */
  clear() {
    localStorage.removeItem(CART_KEY)
    return []
  },

  /**
   * Obtener cantidad total de items
   */
  getItemCount() {
    return this.get().reduce((sum, item) => sum + item.quantity, 0)
  },

  /**
   * Calcular total del carrito incluyendo opciones
   */
  getTotal() {
    return this.get().reduce((sum, item) => {
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