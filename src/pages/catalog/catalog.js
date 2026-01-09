import { supabase } from '../../config/supabase.js'
import { cart } from '../../utils/cart.js'
import { notify } from '../../utils/notifications.js'

// ============================================
// ESTADO GLOBAL
// ============================================
let currentBusiness = null
let categories = []
let products = []
let selectedProduct = null
let productOptions = []
let currentQuantity = 1
let selectedQuickComment = null
let selectedSides = []
let currentSearchQuery = ''
let currentCategoryFilter = 'all'

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const loadingState = document.getElementById('loadingState')
const errorState = document.getElementById('errorState')
const catalogContent = document.getElementById('catalogContent')

const businessName = document.getElementById('businessName')
const businessDescription = document.getElementById('businessDescription')

const categoriesNav = document.getElementById('categoriesNav')
const productsContainer = document.getElementById('productsContainer')

const cartFab = document.getElementById('cartFab')
const cartFabBtn = document.getElementById('cartFabBtn')
const cartCount = document.getElementById('cartCount')

const cartPanel = document.getElementById('cartPanel')
const cartOverlay = document.getElementById('cartOverlay')
const cartClose = document.getElementById('cartClose')
const cartBody = document.getElementById('cartBody')
const cartFooter = document.getElementById('cartFooter')
const cartTotalAmount = document.getElementById('cartTotalAmount')
const btnWhatsapp = document.getElementById('btnWhatsapp')

const productModal = document.getElementById('productModal')
const productModalOverlay = document.getElementById('productModalOverlay')
const productModalClose = document.getElementById('productModalClose')
const productModalImage = document.getElementById('productModalImage')
const productModalName = document.getElementById('productModalName')
const productModalPrice = document.getElementById('productModalPrice')
const productModalDescription = document.getElementById('productModalDescription')
const quantityValue = document.getElementById('quantityValue')
const decreaseQty = document.getElementById('decreaseQty')
const increaseQty = document.getElementById('increaseQty')
const addToCartBtn = document.getElementById('addToCartBtn')

const quickCommentsSection = document.getElementById('quickCommentsSection')
const quickCommentsList = document.getElementById('quickCommentsList')
const sidesSection = document.getElementById('sidesSection')
const sidesList = document.getElementById('sidesList')

// ============================================
// INICIALIZACIÓN
// ============================================
init()

async function init() {
  try {
    // Obtener slug de la URL
    const urlParams = new URLSearchParams(window.location.search)
    const slug = urlParams.get('slug')

    if (!slug) {
      showError()
      return
    }

    // Cargar negocio por slug
    await loadBusiness(slug)

    // Cargar categorías y productos
    await loadCatalogData()

    // Renderizar
    renderBusinessInfo()
    renderCategoriesNav()
    renderProducts()

    // Cargar carrito del localStorage
    updateCartUI()

    // Inicializar búsqueda
    initCatalogSearch()

    showCatalog()

  } catch (error) {
    console.error('Error loading catalog:', error)
    showError()
  }
}

async function loadBusiness(slug) {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) throw error
    if (!data) throw new Error('Business not found')

    currentBusiness = data

    // Trackear visita al catálogo
    trackCatalogVisit(currentBusiness.id)
  } catch (error) {
    console.error('Error loading business:', error)
    throw error
  }
}

// ============================================
// TRACKING FUNCTIONS
// ============================================
function trackCatalogVisit(businessId) {
  try {
    const visitsKey = `catalog_visits_${businessId}`
    const currentVisits = parseInt(localStorage.getItem(visitsKey) || '0')
    localStorage.setItem(visitsKey, (currentVisits + 1).toString())
  } catch (error) {
    console.error('Error tracking catalog visit:', error)
  }
}

function trackProductView(businessId, productId) {
  try {
    const viewsKey = `product_views_${businessId}`
    const productViews = JSON.parse(localStorage.getItem(viewsKey) || '{}')
    
    if (!productViews[productId]) {
      productViews[productId] = 0
    }
    productViews[productId] += 1
    
    localStorage.setItem(viewsKey, JSON.stringify(productViews))
  } catch (error) {
    console.error('Error tracking product view:', error)
  }
}

async function loadCatalogData() {
  try {
    // Cargar categorías
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .order('display_order', { ascending: true })

    if (categoriesError) throw categoriesError
    categories = categoriesData || []

    // Cargar productos disponibles
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('is_available', true)
      .order('display_order', { ascending: true })

    if (productsError) throw productsError
    products = productsData || []

  } catch (error) {
    console.error('Error loading catalog data:', error)
    throw error
  }
}

async function loadProductOptions(productId) {
  try {
    const { data, error } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error loading product options:', error)
    return []
  }
}

// ============================================
// UI STATES
// ============================================
function showError() {
  loadingState.style.display = 'none'
  errorState.style.display = 'flex'
  catalogContent.style.display = 'none'
}

function showCatalog() {
  loadingState.style.display = 'none'
  errorState.style.display = 'none'
  catalogContent.style.display = 'block'
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderBusinessInfo() {
  businessName.textContent = currentBusiness.name
  businessDescription.textContent = currentBusiness.description || ''
  document.title = `${currentBusiness.name} - Catálogo`
}

function renderCategoriesNav() {
  const navTrack = categoriesNav.querySelector('.categories-nav-track')

  // Botón "Todos"
  let html = '<button class="category-nav-btn active" data-category="all">Todos</button>'

  // Botones de categorías
  categories.forEach(category => {
    html += `<button class="category-nav-btn" data-category="${category.id}">${category.name}</button>`
  })

  navTrack.innerHTML = html

  // Event listeners
  navTrack.querySelectorAll('.category-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Actualizar activo
      navTrack.querySelectorAll('.category-nav-btn').forEach(b => b.classList.remove('active'))
      e.target.classList.add('active')

      // Filtrar productos con búsqueda actual
      const categoryId = e.target.dataset.category
      currentCategoryFilter = categoryId
      renderProducts(categoryId, currentSearchQuery)
    })
  })
}

function renderProducts(filteredCategoryId = 'all', searchQuery = '') {
  currentCategoryFilter = filteredCategoryId
  currentSearchQuery = searchQuery

  // Aplicar filtros
  let filteredProducts = products

  // Filtrar por búsqueda
  if (searchQuery.trim()) {
    const query = searchQuery.trim().toLowerCase()
    filteredProducts = filteredProducts.filter(prod => 
      prod.name.toLowerCase().includes(query) ||
      (prod.description && prod.description.toLowerCase().includes(query)) ||
      (prod.categories?.name && prod.categories.name.toLowerCase().includes(query))
    )
  }

  // Filtrar por categoría
  if (filteredCategoryId !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.category_id === filteredCategoryId)
  }

  if (filteredProducts.length === 0) {
    if (searchQuery.trim() || filteredCategoryId !== 'all') {
      productsContainer.innerHTML = '<p class="empty-message">No se encontraron productos</p>'
    } else {
      productsContainer.innerHTML = '<p class="empty-message">No hay productos disponibles</p>'
    }
    return
  }

  let html = ''

  if (filteredCategoryId === 'all' && !searchQuery.trim()) {
    // Mostrar por categorías (vista normal sin búsqueda)
    if (categories.length > 0) {
      categories.forEach(category => {
        const categoryProducts = filteredProducts.filter(p => p.category_id === category.id)
        if (categoryProducts.length > 0) {
          html += renderCategorySection(category, categoryProducts)
        }
      })

      // Productos sin categoría
      const uncategorizedProducts = filteredProducts.filter(p => !p.category_id)
      if (uncategorizedProducts.length > 0) {
        html += renderCategorySection({ name: 'Otros' }, uncategorizedProducts)
      }
    } else {
      // No hay categorías, mostrar todos
      html += `<div class="products-grid">${filteredProducts.map(renderProductCard).join('')}</div>`
    }
  } else {
    // Mostrar como grid simple (cuando hay búsqueda o filtro de categoría)
    html += `<div class="products-grid">${filteredProducts.map(renderProductCard).join('')}</div>`
  }

  productsContainer.innerHTML = html

  // Event listeners para las cards
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const productId = e.currentTarget.dataset.id
      openProductModal(productId)
    })
  })
}

function renderCategorySection(category, categoryProducts) {
  return `
    <div class="category-section">
      <h2>${category.name}</h2>
      <div class="products-grid">
        ${categoryProducts.map(renderProductCard).join('')}
      </div>
    </div>
  `
}

function renderProductCard(product) {
  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card-image">
        ${product.image_url
      ? `<img src="${product.image_url}" alt="${product.name}" loading="lazy">`
      : 'Sin imagen'
    }
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-price">$${parseFloat(product.price).toLocaleString()}</div>
      </div>
    </div>
  `
}

function filterProductsByCategory(categoryId) {
  currentCategoryFilter = categoryId
  renderProducts(categoryId, currentSearchQuery)
}

// ============================================
// CATALOG SEARCH FUNCTIONALITY
// ============================================
function initCatalogSearch() {
  const catalogSearchInput = document.getElementById('catalogSearchInput')
  const clearCatalogSearch = document.getElementById('clearCatalogSearch')

  if (catalogSearchInput && clearCatalogSearch) {
    catalogSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim()
      currentSearchQuery = query
      
      if (query) {
        clearCatalogSearch.style.display = 'flex'
        // Renderizar con búsqueda y categoría actual
        renderProducts(currentCategoryFilter, query)
      } else {
        clearCatalogSearch.style.display = 'none'
        // Renderizar solo con categoría actual
        renderProducts(currentCategoryFilter, '')
      }
    })

    clearCatalogSearch.addEventListener('click', () => {
      catalogSearchInput.value = ''
      clearCatalogSearch.style.display = 'none'
      currentSearchQuery = ''
      // Renderizar solo con categoría actual
      renderProducts(currentCategoryFilter, '')
      catalogSearchInput.focus()
    })
  }
}

// ============================================
// PRODUCT MODAL
// ============================================
async function openProductModal(productId) {
  // Trackear visualización del producto
  if (currentBusiness) {
    trackProductView(currentBusiness.id, productId)
  }
  selectedProduct = products.find(p => p.id === productId)
  if (!selectedProduct) return

  currentQuantity = 1
  selectedQuickComment = null
  selectedSides = []

  // Llenar modal
  productModalName.textContent = selectedProduct.name
  productModalPrice.textContent = `$${parseFloat(selectedProduct.price).toLocaleString()}`
  productModalDescription.textContent = selectedProduct.description || 'Sin descripción'
  quantityValue.textContent = currentQuantity

  if (selectedProduct.image_url) {
    productModalImage.innerHTML = `<img src="${selectedProduct.image_url}" alt="${selectedProduct.name}">`
  } else {
    productModalImage.innerHTML = 'Sin imagen'
  }

  // Cargar opciones del producto
  productOptions = await loadProductOptions(productId)
  renderProductOptions()

  productModal.style.display = 'flex'
}

function renderProductOptions() {
  // Filtrar por tipo
  const quickComments = productOptions.filter(opt => opt.type === 'quick_comment')
  const sides = productOptions.filter(opt => opt.type === 'side')

  // Renderizar comentarios rápidos
  if (quickComments.length > 0) {
    quickCommentsSection.style.display = 'block'
    quickCommentsList.innerHTML = quickComments.map((comment, index) => `
      <div class="quick-comment-option">
        <input 
          type="radio" 
          id="comment-${comment.id}" 
          name="quickComment" 
          value="${comment.id}"
          data-name="${comment.name}"
        >
        <label for="comment-${comment.id}">${comment.name}</label>
      </div>
    `).join('')

    // Event listeners
    quickCommentsList.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedQuickComment = {
            id: e.target.value,
            name: e.target.dataset.name
          }
        }
      })
    })
  } else {
    quickCommentsSection.style.display = 'none'
  }

  // Renderizar acompañantes
  if (sides.length > 0) {
    sidesSection.style.display = 'block'
    sidesList.innerHTML = sides.map(side => `
      <div class="side-option" data-id="${side.id}">
        <div class="side-option-left">
          <input 
            type="checkbox" 
            id="side-${side.id}" 
            value="${side.id}"
            data-name="${side.name}"
            data-price="${side.price}"
          >
          <label for="side-${side.id}" class="side-option-name">${side.name}</label>
        </div>
        <span class="side-option-price">+$${parseFloat(side.price).toLocaleString()}</span>
      </div>
    `).join('')

    // Event listeners
    sidesList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const sideOption = e.target.closest('.side-option')

        if (e.target.checked) {
          sideOption.classList.add('selected')
          selectedSides.push({
            id: e.target.value,
            name: e.target.dataset.name,
            price: parseFloat(e.target.dataset.price)
          })
        } else {
          sideOption.classList.remove('selected')
          selectedSides = selectedSides.filter(s => s.id !== e.target.value)
        }
      })
    })
  } else {
    sidesSection.style.display = 'none'
  }
}

function closeProductModal() {
  productModal.style.display = 'none'
  selectedProduct = null
  productOptions = []
  currentQuantity = 1
  selectedQuickComment = null
  selectedSides = []
}

productModalClose.addEventListener('click', closeProductModal)
productModalOverlay.addEventListener('click', closeProductModal)

decreaseQty.addEventListener('click', () => {
  if (currentQuantity > 1) {
    currentQuantity--
    quantityValue.textContent = currentQuantity
  }
})

increaseQty.addEventListener('click', () => {
  currentQuantity++
  quantityValue.textContent = currentQuantity
})

addToCartBtn.addEventListener('click', () => {
  if (!selectedProduct) return

  const options = {
    quickComment: selectedQuickComment,
    sides: selectedSides
  }

  // Guardar el nombre ANTES de cerrar el modal
  const productName = selectedProduct.name

  cart.add(selectedProduct, currentQuantity, options)
  updateCartUI()
  closeProductModal()

  // Feedback visual con el nombre guardado
  notify.success(`${productName} agregado al carrito`, 2000)
})

// ============================================
// CART UI
// ============================================
function updateCartUI() {
  const cartItems = cart.get()
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  // Actualizar contador
  cartCount.textContent = totalItems

  // Mostrar/ocultar FAB
  if (totalItems > 0) {
    cartFab.style.display = 'block'
  } else {
    cartFab.style.display = 'none'
  }

  // Actualizar panel del carrito si está abierto
  if (cartPanel.style.display === 'flex') {
    renderCartItems()
  }
}

function renderCartItems() {
  const cartItems = cart.get()

  if (cartItems.length === 0) {
    cartBody.innerHTML = '<p class="empty-cart-message">El carrito está vacío</p>'
    cartFooter.style.display = 'none'
    return
  }

  cartBody.innerHTML = cartItems.map(item => {
    // Calcular precio del item con acompañantes
    let itemPrice = parseFloat(item.price)
    if (item.options?.sides && item.options.sides.length > 0) {
      const sidesTotal = item.options.sides.reduce((sum, side) => sum + parseFloat(side.price), 0)
      itemPrice += sidesTotal
    }

    // Construir texto de opciones
    let optionsText = ''
    if (item.options?.quickComment) {
      optionsText += `<div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">• ${item.options.quickComment.name}</div>`
    }
    if (item.options?.sides && item.options.sides.length > 0) {
      optionsText += item.options.sides.map(side =>
        `<div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">+ ${side.name} ($${parseFloat(side.price).toLocaleString()})</div>`
      ).join('')
    }

    return `
      <div class="cart-item" data-key="${item.itemKey}">
        <div class="cart-item-image">
          ${item.image_url
        ? `<img src="${item.image_url}" alt="${item.name}">`
        : ''
      }
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          ${optionsText}
          <div class="cart-item-price">$${itemPrice.toLocaleString()} c/u</div>
          <div class="cart-item-quantity">
            <button class="cart-item-decrease" data-key="${item.itemKey}">-</button>
            <span>${item.quantity}</span>
            <button class="cart-item-increase" data-key="${item.itemKey}">+</button>
          </div>
          <button class="cart-item-remove" data-key="${item.itemKey}">Eliminar</button>
        </div>
      </div>
    `
  }).join('')

  // Total
  const total = cart.getTotal()
  cartTotalAmount.textContent = `$${total.toLocaleString()}`
  cartFooter.style.display = 'block'

  // Event listeners
  document.querySelectorAll('.cart-item-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemKey = e.target.dataset.key
      const item = cartItems.find(i => i.itemKey === itemKey)
      if (item && item.quantity > 1) {
        cart.updateQuantity(itemKey, item.quantity - 1)
        updateCartUI()
        renderCartItems()
      }
    })
  })

  document.querySelectorAll('.cart-item-increase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemKey = e.target.dataset.key
      const item = cartItems.find(i => i.itemKey === itemKey)
      if (item) {
        cart.updateQuantity(itemKey, item.quantity + 1)
        updateCartUI()
        renderCartItems()
      }
    })
  })

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemKey = e.target.dataset.key
      cart.remove(itemKey)
      updateCartUI()
      renderCartItems()
    })
  })
}

// Abrir/cerrar carrito
cartFabBtn.addEventListener('click', () => {
  cartPanel.style.display = 'flex'
  renderCartItems()
})

cartClose.addEventListener('click', () => {
  cartPanel.style.display = 'none'
})

cartOverlay.addEventListener('click', () => {
  cartPanel.style.display = 'none'
})

// ============================================
// WHATSAPP ORDER
// ============================================
// ============================================
// CHECKOUT & WHATSAPP ORDER
// ============================================

const checkoutModal = document.getElementById('checkoutModal')
const checkoutModalOverlay = document.getElementById('checkoutModalOverlay')
const checkoutModalClose = document.getElementById('checkoutModalClose')
const checkoutForm = document.getElementById('checkoutForm')
const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn')

// Abrir modal de checkout
btnWhatsapp.addEventListener('click', () => {
  const cartItems = cart.get()
  if (cartItems.length === 0) {
    notify.warning('El carrito está vacío')
    return
  }

  // Abrir modal
  checkoutModal.style.display = 'flex'
  
  // Focus en el primer campo
  setTimeout(() => {
    document.getElementById('clientName').focus()
  }, 100)
})

// Cerrar modal
function closeCheckoutModal() {
  checkoutModal.style.display = 'none'
  checkoutForm.reset()
}

checkoutModalClose.addEventListener('click', closeCheckoutModal)
checkoutModalOverlay.addEventListener('click', closeCheckoutModal)
cancelCheckoutBtn.addEventListener('click', closeCheckoutModal)

// Enviar pedido
checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  // Capturar datos del formulario
  const clientData = {
    nombre: document.getElementById('clientName').value.trim(),
    telefono: document.getElementById('clientPhone').value.trim(),
    direccion: document.getElementById('clientAddress').value.trim(),
    metodo_pago: document.getElementById('paymentMethod').value,
    observaciones: document.getElementById('clientNotes').value.trim()
  }

  // Generar mensaje de WhatsApp
  await sendWhatsAppOrder(clientData)
})

async function sendWhatsAppOrder(clientData) {
  const cartItems = cart.get()
  if (cartItems.length === 0) return

  try {
    // Obtener la plantilla personalizada del negocio
    const { data } = await supabase
      .from('businesses')
      .select('whatsapp_message_template')
      .eq('id', currentBusiness.id)
      .single()

    // Plantilla por defecto si no hay una personalizada
    const defaultTemplate = `Hola, quiero hacer el siguiente pedido:

{productos}

Total: {total}

Mis datos:
{nombre}
{telefono}
{direccion}
Método de pago: {metodo_pago}

¡Gracias!`

    let template = data?.whatsapp_message_template || defaultTemplate

    // Construir lista de productos
    const productsList = cartItems.map(item => {
      const basePrice = parseFloat(item.price)
      let itemPrice = basePrice

      // Calcular precio con acompañantes
      if (item.options?.sides && item.options.sides.length > 0) {
        const sidesTotal = item.options.sides.reduce((sum, side) => sum + parseFloat(side.price), 0)
        itemPrice += sidesTotal
      }

      const subtotal = itemPrice * item.quantity

      // Línea principal del producto
      let line = `- ${item.quantity}x ${item.name} ($${subtotal.toLocaleString('es-CO')})`

      // Comentario rápido
      if (item.options?.quickComment) {
        line += `\n  ${item.options.quickComment.name}`
      }

      // Acompañantes
      if (item.options?.sides && item.options.sides.length > 0) {
        const sidesText = item.options.sides.map(s => `${s.name} (+$${parseFloat(s.price).toLocaleString('es-CO')})`).join(', ')
        line += `\n  Con: ${sidesText}`
      }

      return line
    }).join('\n')

    // Calcular total
    const total = cart.getTotal()

    // Reemplazar tokens con datos reales
    let message = template
      .replace(/{productos}/g, productsList)
      .replace(/{total}/g, `$${total.toLocaleString('es-CO')}`)
      .replace(/{nombre}/g, clientData.nombre)
      .replace(/{telefono}/g, clientData.telefono)
      .replace(/{direccion}/g, clientData.direccion)
      .replace(/{metodo_pago}/g, clientData.metodo_pago)

    // Agregar observaciones si existen
    if (clientData.observaciones) {
      message += `\n\nObservaciones: ${clientData.observaciones}`
    }

    // Codificar y abrir WhatsApp
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${currentBusiness.whatsapp_number}?text=${encodedMessage}`

    // Cerrar modal
    closeCheckoutModal()

    // Cerrar panel del carrito
    cartPanel.style.display = 'none'

    // Abrir WhatsApp
    window.open(whatsappUrl, '_blank')

    // Feedback
    notify.success('¡Pedido listo! Te redirigimos a WhatsApp')

    // Opcional: Limpiar carrito después de enviar
    // cart.clear()
    // updateCartUI()

  } catch (error) {
    console.error('Error sending WhatsApp order:', error)
    notify.error('Error al generar el pedido')
  }
}

// Validación de teléfono
const phoneInput = document.getElementById('clientPhone')
phoneInput.addEventListener('input', (e) => {
  // Permitir solo números
  e.target.value = e.target.value.replace(/[^0-9]/g, '')
})

// Guardar datos del cliente para próximos pedidos
function saveClientData(clientData) {
  try {
    localStorage.setItem('clientData', JSON.stringify(clientData))
  } catch (error) {
    console.error('Error saving client data:', error)
  }
}

// Cargar datos guardados
function loadSavedClientData() {
  try {
    const saved = localStorage.getItem('clientData')
    if (saved) {
      const data = JSON.parse(saved)
      document.getElementById('clientName').value = data.nombre || ''
      document.getElementById('clientPhone').value = data.telefono || ''
      document.getElementById('clientAddress').value = data.direccion || ''
      document.getElementById('paymentMethod').value = data.metodo_pago || ''
    }
  } catch (error) {
    console.error('Error loading client data:', error)
  }
}

// Llamar al abrir el modal
btnWhatsapp.addEventListener('click', () => {
  const cartItems = cart.get()
  if (cartItems.length === 0) {
    notify.warning('El carrito está vacío')
    return
  }

  checkoutModal.style.display = 'flex'
  loadSavedClientData() // ← Cargar datos guardados
  
  setTimeout(() => {
    document.getElementById('clientName').focus()
  }, 100)
})

// Guardar al enviar
checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const clientData = {
    nombre: document.getElementById('clientName').value.trim(),
    telefono: document.getElementById('clientPhone').value.trim(),
    direccion: document.getElementById('clientAddress').value.trim(),
    metodo_pago: document.getElementById('paymentMethod').value,
    observaciones: document.getElementById('clientNotes').value.trim()
  }

  saveClientData(clientData) // ← Guardar para próximos pedidos
  await sendWhatsAppOrder(clientData)
})