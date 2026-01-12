import { supabase } from '../../config/supabase.js'
import { cart } from '../../utils/cart.js'
import { notify } from '../../utils/notifications.js'
import { promotionsService } from '../../services/promotions.js'
import { promotionOptionsService } from '../../services/promotionOptions.js'


// ============================================
// ESTADO GLOBAL
// ============================================
let currentBusiness = null
let categories = []
let products = []
let paymentMethods = []
let businessHours = []
let businessStatus = { isOpen: true, message: '' }
let selectedProduct = null
let productOptions = []
let currentQuantity = 1
let selectedQuickComment = null
let selectedSides = []
let currentSearchQuery = ''
let currentCategoryFilter = 'all'

// Promotions State
let promotions = []
let currentPromoSlide = 0
let promoAutoPlayInterval = null
let selectedPromotion = null
let selectedPromoQuickComment = null
let selectedPromoSides = []

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

// Promo Elements
const promoBannerContainer = document.getElementById('promoBannerContainer')
const promoSlides = document.getElementById('promoSlides')
const carouselIndicators = document.getElementById('carouselIndicators')

const promotionModal = document.getElementById('promotionModal')
const promotionModalOverlay = document.getElementById('promotionModalOverlay')
const promotionModalClose = document.getElementById('promotionModalClose')
const promotionModalImage = document.getElementById('promotionModalImage')
const promotionModalTitle = document.getElementById('promotionModalTitle')
const promotionModalPrice = document.getElementById('promotionModalPrice')
const promotionModalDescription = document.getElementById('promotionModalDescription')
const promotionProductsSection = document.getElementById('promotionProductsSection')
const promotionProductsList = document.getElementById('promotionProductsList')
const promotionQuickCommentsSection = document.getElementById('promotionQuickCommentsSection')
const promotionQuickCommentsList = document.getElementById('promotionQuickCommentsList')
const promotionSidesSection = document.getElementById('promotionSidesSection')
const promotionSidesList = document.getElementById('promotionSidesList')
const promotionDecreaseQty = document.getElementById('promotionDecreaseQty')
const promotionIncreaseQty = document.getElementById('promotionIncreaseQty')
const promotionQuantityValue = document.getElementById('promotionQuantityValue')
const addPromotionToCartBtn = document.getElementById('addPromotionToCartBtn')

// ============================================
// INICIALIZACIÓN
// ============================================
init()

console.log('CATALOG JS LOADED - VERSION: MOBILE FIXES V6')
// ALERT TEMPORAL PARA VERIFICACIÓN DE DESPLIEGUE MEJORA MÓVIL
alert('🛠️ DEBUG MÓVIL V6\n\nAbra una promoción.\nVerificaremos si es un problema de permisos (ANON vs AUTH).')

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
    renderPromotionsCarousel()

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

    // Cargar métodos de pago
    const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (paymentMethodsError) throw paymentMethodsError
    paymentMethods = paymentMethodsData || []

    // Cargar horarios de negocio
    const { data: hoursData, error: hoursError } = await supabase
      .from('business_hours')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .order('day_of_week', { ascending: true })

    if (hoursError) throw hoursError
    businessHours = hoursData || []

    // Cargar Promociones Activas
    try {
      promotions = await promotionsService.getActiveByBusiness(currentBusiness.id)
    } catch (err) {
      console.error('Error loading promotions', err)
      promotions = []
    }

    // Verificar si el negocio está abierto
    checkBusinessStatus()

  } catch (error) {
    console.error('Error loading catalog data:', error)
    throw error
  }
}

// ============================================
// PROMOTIONS LOGIC
// ============================================

function renderPromotionsCarousel() {
  if (!promotions || promotions.length === 0) {
    if (promoBannerContainer) promoBannerContainer.style.display = 'none'
    return
  }

  if (promoBannerContainer) promoBannerContainer.style.display = 'block'

  // Render Slides
  const slidesHtml = promotions.map((promo, index) => `
    <div class="promo-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
      ${promo.image_url
      ? `<img src="${promo.image_url}" alt="${promo.title}" onclick="window.openPromoDetails(${index})">`
      : `
          <div class="promo-placeholder" onclick="window.openPromoDetails(${index})">
            <i class="ri-fire-line"></i>
            <span>${promo.title}</span>
            <span style="font-size: 0.9rem; font-weight: normal; margin-top:0.25rem;">Ver detalles</span>
          </div>
        `
    }
      <div class="promo-info-overlay" onclick="window.openPromoDetails(${index})">
        <div class="promo-info-title">${promo.title}</div>
        <div class="promo-info-price">$${parseFloat(promo.price).toLocaleString()}</div>
      </div>
    </div>
  `).join('')

  promoSlides.innerHTML = slidesHtml

  // Render Indicators
  if (promotions.length > 1) {
    const indicatorsHtml = promotions.map((_, index) => `
      <div class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="window.goToPromoSlide(${index})"></div>
    `).join('')
    carouselIndicators.innerHTML = indicatorsHtml

    // Start Autoplay
    startPromoAutoplay()
  } else {
    carouselIndicators.innerHTML = ''
  }
}

// Expose these to window so onclick works easily (module scope)
window.goToPromoSlide = (index) => {
  if (index < 0 || index >= promotions.length) return

  // Update slides
  const slides = document.querySelectorAll('.promo-slide')
  slides.forEach(s => s.classList.remove('active'))
  if (slides[index]) slides[index].classList.add('active')

  // Update indicators
  const dots = document.querySelectorAll('.carousel-dot')
  dots.forEach(d => d.classList.remove('active'))
  if (dots[index]) dots[index].classList.add('active')

  currentPromoSlide = index

  // Reset timer
  startPromoAutoplay()
}

window.openPromoDetails = (index) => {
  const promo = promotions[index]
  if (promo) openPromotionModal(promo)
}

function startPromoAutoplay() {
  if (promoAutoPlayInterval) clearInterval(promoAutoPlayInterval)

  promoAutoPlayInterval = setInterval(() => {
    let next = currentPromoSlide + 1
    if (next >= promotions.length) next = 0
    window.goToPromoSlide(next)
  }, 5000) // 5 seconds
}

// Promotion Modal
async function openPromotionModal(promo) {
  console.log('=== openPromotionModal CALLED ===')
  console.log('Promotion ID:', promo.id)
  console.log('Promotion Title:', promo.title)

  if (currentBusiness) {
    // Track view if needed tracking for promos
  }
  selectedPromotion = promo
  currentQuantity = 1
  selectedPromoQuickComment = null
  selectedPromoSides = []

  promotionModalTitle.textContent = promo.title
  promotionModalPrice.textContent = `$${parseFloat(promo.price).toLocaleString()}`
  promotionModalDescription.textContent = promo.description || ''

  if (promo.image_url) {
    promotionModalImage.innerHTML = `<img src="${promo.image_url}" alt="${promo.title}">`
  } else {
    promotionModalImage.innerHTML = `<div class="promo-placeholder"><i class="ri-price-tag-3-line"></i><span>${promo.title}</span></div>`
  }

  promotionQuantityValue.textContent = currentQuantity

  // Load and render options from database
  try {
    console.log('Loading promotion options from database...')
    const options = await promotionOptionsService.getByPromotion(promo.id)
    console.log('Loaded options:', options)

    const quickComments = options.filter(opt => opt.type === 'quick_comment')
    const sides = options.filter(opt => opt.type === 'side')

    console.log('Filtered quick comments:', quickComments)
    console.log('Filtered sides:', sides)

    // Store in promo object for renderPromotionOptions
    promo.quick_comments = quickComments
    promo.sides = sides

    // Store in promo object for renderPromotionOptions
    promo.quick_comments = quickComments
    promo.sides = sides

    // Check Auth Session
    const { data: { session } } = await supabase.auth.getSession()
    const isAuth = !!session
    const authStatus = isAuth ? 'AUTH' : 'ANON'

    // DEBUG: Inject stats into description to verify data on mobile
    const debugStats = `\n\n[DEBUG V6]\nPID: ${promo.id}\nQC: ${quickComments.length} Sides: ${sides.length}\nUser: ${authStatus}`
    if (promotionModalDescription.textContent) {
      promotionModalDescription.textContent += debugStats
    } else {
      promotionModalDescription.textContent = debugStats
    }

    renderPromotionOptions(promo)
  } catch (error) {
    console.error('Error loading promotion options:', error)

    // DEBUG: Show error in modal
    const errorStats = `\n\n[DEBUG V5 ERROR]\n${error.message || error}`
    if (promotionModalDescription.textContent) {
      promotionModalDescription.textContent += errorStats
    } else {
      promotionModalDescription.textContent = errorStats
    }

    // Fallback to JSON fields if they exist
    renderPromotionOptions(promo)
  }

  promotionModal.style.display = 'flex'
  console.log('=== openPromotionModal COMPLETED ===')
}

function renderPromotionOptions(promo) {
  console.log('=== renderPromotionOptions CALLED ===')
  console.log('Promotion:', promo)

  // Quick Comments
  const quickComments = promo.quick_comments || []
  console.log('Quick Comments:', quickComments)
  console.log('Quick Comments Length:', quickComments.length)

  if (quickComments.length > 0) {
    console.log('Showing quick comments section')
    promotionQuickCommentsSection.classList.remove('hidden')
    promotionQuickCommentsSection.style.display = 'block' // Force visibility inline
    promotionQuickCommentsList.innerHTML = quickComments.map((comment, index) => `
          <div class="quick-comment-option">
            <input 
              type="radio" 
              id="promo-comment-${index}" 
              name="promoQuickComment" 
              value="${comment.name}"
            >
            <label for="promo-comment-${index}">${comment.name}</label>
          </div>
        `).join('')

    promotionQuickCommentsList.querySelectorAll('input').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) selectedPromoQuickComment = { name: e.target.value }
      })
    })
  } else {
    console.log('Hiding quick comments section (no comments)')
    promotionQuickCommentsSection.classList.add('hidden')
    promotionQuickCommentsSection.style.display = 'none'
  }

  // Sides
  const sides = promo.sides || []
  console.log('Sides:', sides)
  console.log('Sides Length:', sides.length)

  if (sides.length > 0) {
    console.log('Showing sides section')
    promotionSidesSection.classList.remove('hidden')
    promotionSidesSection.style.display = 'block' // Force visibility inline
    promotionSidesList.innerHTML = sides.map((side, index) => `
          <div class="side-option">
            <div class="side-option-left">
              <input 
                type="checkbox" 
                id="promo-side-${index}" 
                value="${side.name}"
                data-price="${side.price}"
              >
              <label for="promo-side-${index}" class="side-option-name">${side.name}</label>
            </div>
            <span class="side-option-price">+$${parseFloat(side.price).toLocaleString()}</span>
          </div>
        `).join('')

    promotionSidesList.querySelectorAll('input').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const sideOption = e.target.closest('.side-option')
        const sideName = e.target.value
        const sidePrice = parseFloat(e.target.dataset.price)

        if (e.target.checked) {
          sideOption.classList.add('selected')
          selectedPromoSides.push({ name: sideName, price: sidePrice })
        } else {
          sideOption.classList.remove('selected')
          selectedPromoSides = selectedPromoSides.filter(s => s.name !== sideName)
        }
      })
    })
  } else {
    console.log('Hiding sides section (no sides)')
    promotionSidesSection.classList.add('hidden')
    promotionSidesSection.style.display = 'none'
  }

  console.log('=== renderPromotionOptions COMPLETED ===')
}

function closePromotionModalFunc() {
  promotionModal.style.display = 'none'
  selectedPromotion = null

  // Reset visibility states
  promotionQuickCommentsSection.classList.add('hidden')
  promotionSidesSection.classList.add('hidden')
}

if (promotionModalClose) promotionModalClose.addEventListener('click', closePromotionModalFunc)
if (promotionModalOverlay) promotionModalOverlay.addEventListener('click', closePromotionModalFunc)

if (promotionDecreaseQty) {
  promotionDecreaseQty.addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--
      promotionQuantityValue.textContent = currentQuantity
    }
  })
}

if (promotionIncreaseQty) {
  promotionIncreaseQty.addEventListener('click', () => {
    currentQuantity++
    promotionQuantityValue.textContent = currentQuantity
  })
}

if (addPromotionToCartBtn) {
  addPromotionToCartBtn.addEventListener('click', () => {
    if (!selectedPromotion) return

    const options = {
      quickComment: selectedPromoQuickComment,
      sides: selectedPromoSides,
      isPromotion: true // Flag to identify in cart if needed
    }

    const promoItem = {
      id: selectedPromotion.id,
      name: selectedPromotion.title, // Map title to name for cart consistency
      price: selectedPromotion.price,
      image_url: selectedPromotion.image_url,
      is_promotion: true
    }

    // Guardar el título ANTES de cerrar el modal
    const promoTitle = selectedPromotion.title

    cart.add(promoItem, currentQuantity, options)
    updateCartUI()
    closePromotionModalFunc()
    notify.success(`${promoTitle} agregado al carrito`, 2000)
  })
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

  // Render Logo and Favicon
  const headerLogo = document.getElementById('headerLogo')
  if (headerLogo) {
    if (currentBusiness.logo_url) {
      headerLogo.style.display = 'block'
      headerLogo.innerHTML = `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}" style="object-fit:cover; width:100%; height:100%;">`

      // Update Favicon
      const favicon = document.getElementById('dynamicFavicon')
      if (favicon) {
        favicon.href = currentBusiness.logo_url
      }
    } else {
      headerLogo.style.display = 'none'
    }
  }
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
      <div class="products-row">
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
    quickCommentsSection.classList.remove('hidden')
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
    quickCommentsSection.classList.add('hidden')
  }

  // Renderizar acompañantes
  if (sides.length > 0) {
    sidesSection.classList.remove('hidden')
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
    sidesSection.classList.add('hidden')
  }
}

function closeProductModal() {
  productModal.style.display = 'none'
  selectedProduct = null
  productOptions = []
  currentQuantity = 1
  selectedQuickComment = null
  selectedSides = []

  // Reset visibility states
  quickCommentsSection.classList.add('hidden')
  sidesSection.classList.add('hidden')
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
// CHECKOUT & WHATSAPP ORDER
// ============================================

const checkoutModal = document.getElementById('checkoutModal')
const checkoutModalOverlay = document.getElementById('checkoutModalOverlay')
const checkoutModalClose = document.getElementById('checkoutModalClose')
const checkoutForm = document.getElementById('checkoutForm')
const cancelCheckoutBtn = document.getElementById('cancelCheckoutBtn')

// Abrir modal de checkout
// Poblar métodos de pago
function populatePaymentMethods() {
  const paymentMethodSelect = document.getElementById('paymentMethod')

  // Limpiar opciones existentes excepto la primera
  paymentMethodSelect.innerHTML = '<option value="">Selecciona un método</option>'

  // Si hay métodos de pago configurados, usarlos
  if (paymentMethods && paymentMethods.length > 0) {
    paymentMethods.forEach(method => {
      const option = document.createElement('option')
      option.value = method.name
      option.textContent = method.name
      paymentMethodSelect.appendChild(option)
    })
  } else {
    // Métodos por defecto si no hay configurados
    const defaultMethods = ['Efectivo', 'Transferencia', 'Tarjeta', 'Nequi', 'Daviplata']
    defaultMethods.forEach(method => {
      const option = document.createElement('option')
      option.value = method
      option.textContent = method
      paymentMethodSelect.appendChild(option)
    })
  }
}

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
    barrio: document.getElementById('clientBarrio').value.trim(),
    metodo_pago: document.getElementById('paymentMethod').value,
    observaciones: document.getElementById('clientNotes').value.trim()
  }

  saveClientData(clientData) // Guardar para próximos pedidos
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
      .replace(/{metodo_pago}/g, clientData.metodo_pago)
      .replace(/{barrio}/g, clientData.barrio) // Reemplazo directo si existe el token

    // Lógica inteligente para dirección:
    // Si la plantilla YA incluía {barrio}, solo reemplazamos {direccion} tal cual.
    // Si la plantilla NO incluía {barrio}, lo agregamos a la dirección para mantener compatibilidad.
    if (template.includes('{barrio}')) {
      message = message.replace(/{direccion}/g, clientData.direccion)
    } else {
      message = message.replace(/{direccion}/g, `${clientData.direccion} - ${clientData.barrio}`)
    }

    // Agregar observaciones si existen
    if (clientData.observaciones) {
      message += `\n\nObservaciones: ${clientData.observaciones}`
    }

    // Codificar y abrir WhatsApp
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${currentBusiness.whatsapp_number}?text=${encodedMessage}`

    // Cerrar modal de checkout
    closeCheckoutModal()

    // Cerrar panel del carrito
    cartPanel.style.display = 'none'

    // Opcional: Feedback visual de redirección
    showRedirectModal(whatsappUrl)

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
      if (document.getElementById('clientBarrio')) {
        document.getElementById('clientBarrio').value = data.barrio || ''
      }
      document.getElementById('paymentMethod').value = data.metodo_pago || ''
    }
  } catch (error) {
    console.error('Error loading client data:', error)
  }
}

// ============================================
// BUSINESS HOURS CHECKING
// ============================================

function checkBusinessStatus() {
  if (!businessHours || businessHours.length === 0) {
    // Si no hay horarios configurados, asumir que está abierto
    businessStatus = { isOpen: true, message: 'Abierto' }
    renderBusinessStatus()
    return
  }

  const now = new Date()
  const currentDay = now.getDay() // 0 = Sunday, 6 = Saturday
  const currentTime = now.toTimeString().slice(0, 5) // "HH:MM"

  // Buscar horario del día actual
  const todayHours = businessHours.find(h => h.day_of_week === currentDay)

  if (!todayHours || !todayHours.is_open) {
    businessStatus = {
      isOpen: false,
      message: 'Cerrado hoy',
      nextOpening: getNextOpeningTime()
    }
    renderBusinessStatus()
    return
  }

  // Comparar hora actual con horarios
  if (currentTime >= todayHours.open_time && currentTime < todayHours.close_time) {
    businessStatus = {
      isOpen: true,
      message: `Abierto hasta las ${todayHours.close_time}`
    }
  } else {
    businessStatus = {
      isOpen: false,
      message: currentTime < todayHours.open_time
        ? `Cerrado - Abre a las ${todayHours.open_time}`
        : `Cerrado - Abre mañana`,
      nextOpening: getNextOpeningTime()
    }
  }

  renderBusinessStatus()
}

function getNextOpeningTime() {
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

function renderBusinessStatus() {
  // Crear badge de estado si no existe
  let statusBadge = document.getElementById('businessStatusBadge')
  if (!statusBadge) {
    const headerContent = document.querySelector('.header-content')
    if (headerContent) {
      statusBadge = document.createElement('div')
      statusBadge.id = 'businessStatusBadge'
      statusBadge.className = 'business-status-badge'
      headerContent.appendChild(statusBadge)
    }
  }

  if (statusBadge) {
    statusBadge.className = `business-status-badge ${businessStatus.isOpen ? 'open' : 'closed'}`
    statusBadge.innerHTML = `
      <i class="ri-${businessStatus.isOpen ? 'check' : 'close'}-circle-fill"></i>
      <span>${businessStatus.message}</span>
    `
  }
}

// Llamar al abrir el modal - ACTUALIZADO
btnWhatsapp.addEventListener('click', () => {
  const cartItems = cart.get()
  if (cartItems.length === 0) {
    notify.warning('El carrito está vacío')
    return
  }

  // Verificar si el negocio está abierto
  if (!businessStatus.isOpen) {
    showClosedModal()
    return
  }

  // Poblar métodos de pago dinámicamente
  populatePaymentMethods()

  // Abrir modal
  checkoutModal.style.display = 'flex'

  // Cargar datos guardados
  loadSavedClientData()

  // Focus en el primer campo
  setTimeout(() => {
    document.getElementById('clientName').focus()
  }, 100)
})

// Modal de negocio cerrado
function showClosedModal() {
  const existingModal = document.getElementById('closedModal')
  if (existingModal) {
    existingModal.remove()
  }

  const modal = document.createElement('div')
  modal.id = 'closedModal'
  modal.className = 'closed-modal'
  modal.innerHTML = `
    <div class="closed-modal-overlay"></div>
    <div class="closed-modal-content">
      <div class="closed-modal-icon">
        <i class="ri-time-line"></i>
      </div>
      <h2>Negocio Cerrado</h2>
      <p>Lo sentimos, actualmente no estamos recibiendo pedidos.</p>
      ${businessStatus.nextOpening ? `<p class="next-opening">Abrimos: <strong>${businessStatus.nextOpening}</strong></p>` : ''}
      <button class="btn-primary" id="closeClosedModal">
        Entendido
      </button>
    </div>
  `

  document.body.appendChild(modal)

  // Event listeners
  const closeBtn = modal.querySelector('#closeClosedModal')
  const overlay = modal.querySelector('.closed-modal-overlay')

  closeBtn.addEventListener('click', () => modal.remove())
  overlay.addEventListener('click', () => modal.remove())
}

// ============================================
// REDIRECT MODAL
// ============================================
function showRedirectModal(url) {
  const modal = document.createElement('div')
  modal.className = 'redirect-modal'
  modal.innerHTML = `
    <div class="redirect-modal-content">
      <div class="redirect-icon">
        <i class="ri-whatsapp-line"></i>
      </div>
      <h2>Enviando pedido a WhatsApp</h2>
      <p>Serás redirigido en unos segundos...</p>
      <div class="redirect-spinner"></div>
    </div>
  `
  document.body.appendChild(modal)

  // Redirigir después de 3 segundos
  setTimeout(() => {
    window.open(url, '_blank')
    // Remover modal y mostrar éxito
    setTimeout(() => {
      modal.remove()
      notify.success('¡Pedido enviado con éxito!')
      cart.clear()
      updateCartUI()
    }, 1000)
  }, 3000)
}
