import { supabase } from '../../config/supabase.js'
import { cart } from '../../utils/cart.js'
import { notify } from '../../utils/notifications.js'
import { promotionsService } from '../../services/promotions.js'
import { dailyMenusService } from '../../services/dailyMenus.js'
import { promotionOptionsService } from '../../services/promotionOptions.js'
import { productSizesService } from '../../services/productSizes.js'
import { favorites } from '../../utils/favorites.js'
import { colorUtils } from '../../utils/colorUtils.js'
import { ordersService } from '../../services/orders.js'
import { businessService } from '../../services/business.js'
import { productOptionsService } from '../../services/productOptions.js'
import gsap from 'gsap'



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
let selectedQuickComments = []
let selectedSides = []
let selectedSize = null
let currentSearchQuery = ''
let currentCategoryFilter = 'all'
let activeDailyMenu = null

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

console.log('CATALOG JS LOADED')

async function init() {
  try {
    // 1. Obtener slug de la URL (Estrategia: Path > Query Params)
    let slug = null

    // Intentar obtener desde ruta limpia: /c/{slug}
    const pathMatch = window.location.pathname.match(/\/c\/([^/]+)/)
    if (pathMatch) {
      slug = pathMatch[1]
    }

    // Fallback: Intentar query param (legacy)
    const urlParams = new URLSearchParams(window.location.search)
    const querySlug = urlParams.get('slug')

    // Si tenemos query param pero no path slug, redirigir a URL limpia
    if (querySlug && !slug) {
      // Remover slug de los params y mantener otros (ej. ?product=123)
      urlParams.delete('slug')
      const newSearch = urlParams.toString()
      const newUrl = `/c/${querySlug}${newSearch ? `?${newSearch}` : ''}`

      // Redirección reemplazando historia para evitar bucles
      window.location.replace(newUrl)
      return // Detener ejecución
    }

    if (!slug) {
      showError()
      return
    }

    // Si llegamos aquí, tenemos slug (ya sea del path o teníamos conflicto que se resolvió)

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

    initCatalogSearch()

    showCatalog()

    showCatalog()

    // Header scroll compression
    initHeaderScrollCompression()

    // NEW: Render Desktop Sidebar Categories
    renderDesktopSidebarCategories()

    // Initial check for cart layout
    toggleDynamicCartLayout()

    // Scroll optimization for Categories
    const categoriesNav = document.getElementById('categoriesNav')
    const scrollLeftBtn = document.getElementById('scrollLeft')
    const scrollRightBtn = document.getElementById('scrollRight')

    if (scrollLeftBtn && scrollRightBtn && categoriesNav) {
      scrollLeftBtn.addEventListener('click', () => {
        categoriesNav.scrollBy({ left: -200, behavior: 'smooth' })
      })

      scrollRightBtn.addEventListener('click', () => {
        categoriesNav.scrollBy({ left: 200, behavior: 'smooth' })
      })
    }

    // Desktop Promo Banner Scroll Effect
    const promoBanner = document.getElementById('promoBannerContainer')
    if (promoBanner && window.matchMedia("(min-width: 1024px)").matches) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          promoBanner.classList.add('promo-banner-hidden')
        } else {
          promoBanner.classList.remove('promo-banner-hidden')
        }
      })
    }

    // Initialize scroll animations
    initScrollAnimations()

    // Initialize favorites system
    initFavorites()

    // Check deep links
    checkInitialUrl()

    // Limpiar carritos antiguos
    cleanOldCarts()

  } catch (error) {
    if (error.message === 'Business not operational' || error.message === 'Business incomplete') {
      // Handled by showMaintenanceState
      return
    }
    if (error.message !== 'Business not found') {
      console.error('Error loading catalog:', error)
    }
    showError()
  }
}

async function loadBusiness(slug) {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Business not found')
      }
      throw error
    }
    if (!data) throw new Error('Business not found')

    currentBusiness = data

    // Verificar estado operativo
    const isOperational = checkSubscriptionStatus(currentBusiness)
    if (!isOperational) {
      showMaintenanceState()
      throw new Error('Business not operational') // Stop loading
    }

    // Trackear visita al catálogo
    trackCatalogVisit(currentBusiness.id)
  } catch (error) {
    if (error.message === 'Business not operational') {
      // Handled by showMaintenanceState, just rethrow or ignore to stop flow
      throw error
    }
    if (error.message !== 'Business not found') {
      console.error('Error loading business:', error)
    }
    throw error
  }
}

// Helper: Check operational status
function checkSubscriptionStatus(business) {
  if (!business) return false

  // 1. Check manual status
  if (business.is_active === false) return false

  // 2. Check expiration
  if (business.plan_expires_at) {
    const expiresAt = new Date(business.plan_expires_at)
    const now = new Date()
    if (now > expiresAt) return false
  }

  return true
}

function showMaintenanceState() {
  document.getElementById('loadingState').style.display = 'none'
  document.getElementById('catalogContent').style.display = 'none'
  document.getElementById('maintenanceState').style.display = 'flex'

  if (currentBusiness?.whatsapp_number) {
    const btn = document.getElementById('maintenanceWhatsAppBtn')
    if (btn) {
      btn.style.display = 'flex'
      btn.onclick = () => {
        window.open(`https://wa.me/${currentBusiness.whatsapp_number}`, '_blank')
      }
    }
  }
}

async function loadCatalogData() {
  try {
    // Cargar categorías activas
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (categoriesError) throw categoriesError
    categories = categoriesData || []

    // Cargar Menú del Día activo
    try {
      activeDailyMenu = await dailyMenusService.getActive(currentBusiness.id)
    } catch (err) {
      console.error('Error loading daily menu:', err)
      activeDailyMenu = null
    }

    // Cargar productos disponibles
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', currentBusiness.id)
      .eq('is_available', true)
      .eq('is_active', true) // Only show active products
      .order('display_order', { ascending: true })

    if (productsError) throw productsError
    products = productsData || []

    // Cargar descuentos activos
    try {
      const { data: discountsData, error: discountsError } = await supabase
        .from('product_discounts')
        .select('*')
        .in('product_id', products.map(p => p.id))
        .eq('is_active', true)

      if (discountsError) throw discountsError

      // Attach discounts to products
      const discounts = discountsData || []
      products.forEach(product => {
        const discount = discounts.find(d => d.product_id === product.id)
        if (discount) {
          // Validate date range
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const startDate = new Date(discount.start_date)
          startDate.setHours(0, 0, 0, 0)
          const endDate = new Date(discount.end_date)
          endDate.setHours(23, 59, 59, 999)

          // Only attach if discount is within valid date range
          if (today >= startDate && today <= endDate) {
            product.discount = discount
          }
        }
      })
    } catch (error) {
      console.error('Error loading discounts:', error)
      // Continue without discounts if error
    }

    // Cargar tamaños de productos
    try {
      const { data: sizesData, error: sizesError } = await supabase
        .from('product_sizes')
        .select('*')
        .in('product_id', products.map(p => p.id))
        .order('price', { ascending: true })

      if (sizesError) throw sizesError

      // Attach sizes to products
      const sizes = sizesData || []
      products.forEach(product => {
        product.sizes = sizes.filter(s => s.product_id === product.id)
      })
    } catch (error) {
      console.error('Error loading sizes:', error)
      // Continue without sizes if error
    }

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

    // Verify operational readiness (NEW)
    // If no payment methods OR no business hours, block catalog
    if (!paymentMethods || paymentMethods.length === 0 || !businessHours || businessHours.length === 0) {
      console.warn('Business Incomplete: Missing payment methods or hours')
      showMaintenanceState()
      throw new Error('Business incomplete')
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

  updateUrl('promotion', promo.id)

  selectedPromotion = promo
  currentQuantity = 1
  selectedPromoQuickComment = null
  selectedPromoSides = []

  promotionModalTitle.textContent = promo.title
  promotionModalPrice.textContent = `$${parseFloat(promo.price).toLocaleString()}`
  promotionModalDescription.textContent = promo.description || ''

  // Update header title
  const promotionModalHeaderTitle = document.getElementById('promotionModalHeaderTitle')
  if (promotionModalHeaderTitle) {
    promotionModalHeaderTitle.textContent = promo.title
  }

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

    renderPromotionOptions(promo)
  } catch (error) {
    console.error('Error loading promotion options:', error)

    // Fallback to JSON fields if they exist
    renderPromotionOptions(promo)
  }

  promotionModal.style.display = 'flex'

  // Setup scroll listener for header title
  const promotionModalBody = document.querySelector('#promotionModal .product-modal-body')
  const promotionModalHeader = document.querySelector('#promotionModal .product-modal-header')

  if (promotionModalBody && promotionModalHeader) {
    promotionModalBody.addEventListener('scroll', function () {
      if (promotionModalBody.scrollTop > 1) {
        promotionModalHeader.classList.add('scrolled')
      } else {
        promotionModalHeader.classList.remove('scrolled')
      }
    })
  }

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
    promotionQuickCommentsSection.classList.remove('hidden')
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
    promotionQuickCommentsSection.classList.add('hidden')
  }

  // Sides
  const sides = promo.sides || []
  console.log('Sides:', sides)
  console.log('Sides Length:', sides.length)

  if (sides.length > 0) {
    promotionSidesSection.classList.remove('hidden')
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
    promotionSidesSection.classList.add('hidden')
  }

  console.log('=== renderPromotionOptions COMPLETED ===')
}

function closePromotionModalFunc() {
  clearUrl()
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

    cart.add(currentBusiness.id, promoItem, currentQuantity, options)
    updateCartUI()
    closePromotionModalFunc()
    notify.success(`${promoTitle} agregado al carrito`, 2000)
  })
}

// ============================================
// TRACKING FUNCTIONS
// ============================================
async function trackCatalogVisit(businessId) {
  try {
    // Basic session debounce to avoid spamming the DB on reload
    const sessionKey = `visited_${businessId}`
    if (sessionStorage.getItem(sessionKey)) return

    // Call secure DB function
    const { error } = await supabase.rpc('increment_visit_count', {
      p_business_id: businessId
    })

    if (error) throw error

    // Mark as visited for this session
    sessionStorage.setItem(sessionKey, 'true')

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

  const footer = document.querySelector('.catalog-footer')
  if (footer) footer.style.display = 'none'
}

function showCatalog() {
  loadingState.style.display = 'none'
  errorState.style.display = 'none'
  // Remove inline style so CSS can control display (Flex on Desktop, Block on Mobile)
  catalogContent.style.display = ''
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
  const loadingLogo = document.getElementById('loadingLogo')

  if (headerLogo) {
    if (currentBusiness.logo_url) {
      headerLogo.style.display = 'block'
      headerLogo.innerHTML = `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}" style="object-fit:cover; width:100%; height:100%;">`

      // Update loading logo too
      if (loadingLogo) {
        loadingLogo.innerHTML = `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}" style="object-fit:cover; width:100%; height:100%;">`
      }

      // Update Favicon
      const favicon = document.getElementById('dynamicFavicon')
      if (favicon) {
        favicon.href = currentBusiness.logo_url
      }
    } else {
      headerLogo.style.display = 'none'
    }
  }

  // Render Address
  const addressEl = document.getElementById('businessAddress')
  if (addressEl) {
    if (currentBusiness.address) {
      addressEl.style.display = 'flex'
      addressEl.querySelector('.text').textContent = currentBusiness.address
    } else {
      addressEl.style.display = 'none'
    }
  }

  // Render Phone (WhatsApp)
  const phoneEl = document.getElementById('businessPhone')
  if (phoneEl) {
    if (currentBusiness.whatsapp_number) {
      phoneEl.style.display = 'flex'
      phoneEl.querySelector('.text').textContent = currentBusiness.whatsapp_number
    } else {
      phoneEl.style.display = 'none'
    }
  }

  // --- DESKTOP SIDEBAR POPULATION ---
  const sidebarLogo = document.getElementById('sidebarLogo')
  const sidebarName = document.getElementById('sidebarBusinessName')
  const sidebarDesc = document.getElementById('sidebarDescription')
  const sidebarAddr = document.getElementById('sidebarAddress')
  const sidebarPh = document.getElementById('sidebarPhone')
  const desktopSidebar = document.getElementById('desktopSidebar')

  if (desktopSidebar) {
    // Show sidebar if desktop (handled by CSS, but ensure content)
    if (currentBusiness.logo_url && sidebarLogo) {
      sidebarLogo.innerHTML = `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}">`
    }
    if (sidebarName) sidebarName.textContent = currentBusiness.name
    if (sidebarDesc) sidebarDesc.textContent = currentBusiness.description || ''

    if (sidebarAddr) {
      if (currentBusiness.address) {
        sidebarAddr.style.display = 'flex'
        sidebarAddr.querySelector('.text').textContent = currentBusiness.address
      } else {
        sidebarAddr.style.display = 'none'
      }
    }

    if (sidebarPh) {
      if (currentBusiness.whatsapp_number) {
        sidebarPh.style.display = 'flex'
        sidebarPh.querySelector('.text').textContent = currentBusiness.whatsapp_number
      } else {
        sidebarPh.style.display = 'none'
      }
    }
  }

  // Apply Custom Color
  if (currentBusiness.primary_color) {
    const primaryColor = currentBusiness.primary_color
    const primaryHover = colorUtils.darken(primaryColor, 10) // Darken by 10%

    document.documentElement.style.setProperty('--color-primary', primaryColor)
    document.documentElement.style.setProperty('--primary-hover', primaryHover)
  }

  // Apply Header Background Image
  const catalogHeader = document.querySelector('.catalog-header')
  if (catalogHeader) {
    if (currentBusiness.header_background_url) {
      catalogHeader.style.backgroundImage = `url('${currentBusiness.header_background_url}')`
      catalogHeader.classList.add('has-background-image')
    } else {
      catalogHeader.style.backgroundImage = 'none'
      catalogHeader.classList.remove('has-background-image')
    }
  }
}


function renderCategoriesNav() {
  const navTrack = categoriesNav.querySelector('.categories-nav-track')

  // Botón "Todos"
  let html = '<button class="category-nav-btn active" data-category="all">Todos</button>'

  // Menú del Día (Si existe)
  if (activeDailyMenu) {
    html += `<button class="category-nav-btn category-nav-daily" data-category="daily-menu" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border: none;"><i class="ri-restaurant-line"></i> ${activeDailyMenu.name}</button>`
  }

  // Botón "Imperdibles" - Solo si hay productos con descuento activo
  const hasDiscountedProducts = products.some(p => p.discount)
  if (hasDiscountedProducts) {
    html += '<button class="category-nav-btn category-nav-imperdibles" data-category="imperdibles"><i class="ri-star-fill"></i> Imperdibles</button>'
  }

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

function renderDesktopSidebarCategories() {
  const sidebarContainer = document.getElementById('sidebarCategories')
  const desktopSidebar = document.getElementById('desktopSidebar')
  if (!sidebarContainer || !desktopSidebar) return

  // CLEAR SIDEBAR CONTENT to rebuild structure based on inspiration
  desktopSidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div id="desktopSidebarLogo" class="sidebar-logo">
           ${currentBusiness.logo_url ? `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}">` : '<i class="ri-store-2-line"></i>'}
        </div>
        <h2 class="sidebar-business-name">${currentBusiness.name}</h2>
      </div>
      
      <div class="sidebar-info-group">
        <div class="sidebar-label">Información</div>
        ${currentBusiness.address ? `
        <div class="sidebar-contact-item">
          <i class="ri-map-pin-line"></i>
          <span>${currentBusiness.address}</span>
        </div>` : ''}
        ${currentBusiness.whatsapp_number ? `
        <div class="sidebar-contact-item">
          <i class="ri-whatsapp-line"></i>
          <span>${currentBusiness.whatsapp_number}</span>
        </div>` : ''}
        <div class="sidebar-contact-item business-status ${businessStatus.isOpen ? 'open' : 'closed'}">
          <i class="ri-time-line"></i>
          <span>${businessStatus.message}</span>
        </div>
      </div>
    </div>
    
    <nav class="sidebar-nav" id="desktopSidebarNav">
       <div class="sidebar-label">Categorías</div>
       <!-- Categories injected here -->
    </nav>
    
    <div class="sidebar-footer">
       <!-- Compact Logo -->
       <img src="/logo_traego.svg" alt="TraeGo" class="traego-logo-img">
       
       <!-- Compact Button -->
       <a href="https://traego.co" target="_blank" rel="noopener noreferrer" class="btn-traego">
          <span>Ir a TraeGo</span>
          <i class="ri-external-link-line"></i>
       </a>
    </div>
  `

  const navContainer = document.getElementById('desktopSidebarNav')

  // Reuse categories data
  let html = '<div class="sidebar-label">Categorías</div>'

  // "Todos" option
  html += `
    <div class="sidebar-category-item active" data-category="all" onclick="window.selectSidebarCategory('all')">
      <i class="ri-apps-line"></i>
      <span>Todos</span>
    </div>
    
    ${activeDailyMenu ? `
    <div class="sidebar-category-item category-daily-menu" data-category="daily-menu" onclick="window.selectSidebarCategory('daily-menu')" style="color: #16a34a; font-weight: 600; background: #f0fdf4;">
      <i class="ri-restaurant-line"></i>
      <span>${activeDailyMenu.name}</span>
    </div>` : ''}
  `

  // "Imperdibles" option
  const hasDiscountedProducts = products.some(p => p.discount)
  if (hasDiscountedProducts) {
    html += `
      <div class="sidebar-category-item sidebar-imperdibles" data-category="imperdibles" onclick="window.selectSidebarCategory('imperdibles')">
        <i class="ri-star-fill"></i> <span>Imperdibles</span>
      </div>
    `
  }

  // Categories
  categories.forEach(category => {
    // Basic icon mapping based on name (optional improvement)
    let icon = 'ri-price-tag-3-line'
    if (category.name.toLowerCase().includes('hamburguesa')) icon = 'ri-goblet-line' // Example

    html += `
      <div class="sidebar-category-item" data-category="${category.id}" onclick="window.selectSidebarCategory('${category.id}')">
        <i class="${icon}"></i>
        <span>${category.name}</span>
      </div>
    `
  })

  navContainer.innerHTML = html
}

window.selectSidebarCategory = (categoryId) => {
  // Update UI active state
  document.querySelectorAll('.sidebar-category-item').forEach(el => {
    el.classList.remove('active')
    if (el.dataset.category === categoryId) el.classList.add('active')
  })

  // Sync with mobile nav if possible (optional but good for consistency)
  document.querySelectorAll('.category-nav-btn').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.category === categoryId) btn.classList.add('active')
  })

  // Render Products
  currentCategoryFilter = categoryId
  renderProducts(categoryId, currentSearchQuery)

  // Scroll to top of products
  document.getElementById('catalogMain')?.scrollIntoView({ behavior: 'smooth' })
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

  // Filtrar por categoría especial "Imperdibles" (productos con descuento)
  if (filteredCategoryId === 'imperdibles') {
    filteredProducts = filteredProducts.filter(p => p.discount)
  }
  // Filtrar por categoría normal
  else if (filteredCategoryId !== 'all' && filteredCategoryId !== 'daily-menu') {
    filteredProducts = filteredProducts.filter(p => p.category_id === filteredCategoryId)
  }

  if (filteredProducts.length === 0 && filteredCategoryId !== 'daily-menu') {
    if (searchQuery.trim() || filteredCategoryId !== 'all') {
      productsContainer.innerHTML = '<p class="empty-message">No se encontraron productos</p>'
    } else {
      productsContainer.innerHTML = '<p class="empty-message">No hay productos disponibles</p>'
    }
    return
  }

  let html = ''

  // Special Case: Daily Menu Filter
  if (filteredCategoryId === 'daily-menu' && activeDailyMenu) {
    const menuProductIds = activeDailyMenu.daily_menu_items.map(item => item.product_id)
    const menuProducts = filteredProducts.filter(p => menuProductIds.includes(p.id))

    if (menuProducts.length > 0) {
      // Sort
      const sortMap = new Map()
      activeDailyMenu.daily_menu_items.forEach((item, index) => sortMap.set(item.product_id, index))
      menuProducts.sort((a, b) => (sortMap.get(a.id) || 0) - (sortMap.get(b.id) || 0))

      html += renderCategorySection({ name: activeDailyMenu.name, isDailyMenu: true }, menuProducts, 'grid')
    } else {
      productsContainer.innerHTML = '<p class="empty-message">No hay productos en el menú del día</p>'
      return
    }
  }

  else if (filteredCategoryId === 'all' && !searchQuery.trim()) {

    // 1. Mostrar Menú del Día si está activo (Destacado)
    if (activeDailyMenu) {
      const menuProductIds = activeDailyMenu.daily_menu_items.map(item => item.product_id)
      const menuProducts = filteredProducts.filter(p => menuProductIds.includes(p.id))

      if (menuProducts.length > 0) {
        // Sort
        const sortMap = new Map()
        activeDailyMenu.daily_menu_items.forEach((item, index) => sortMap.set(item.product_id, index))
        menuProducts.sort((a, b) => (sortMap.get(a.id) || 0) - (sortMap.get(b.id) || 0))

        // Determinamos si es el único contenido (sin categorías activas)
        const isOnlyDailyMenu = categories.length === 0
        const layout = isOnlyDailyMenu ? 'grid' : 'row'

        html += renderCategorySection({ name: activeDailyMenu.name, isDailyMenu: true }, menuProducts, layout)
      }
    }

    // 2. Mostrar por categorías (vista normal sin búsqueda)
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
      // No hay categorías, mostrar todos solo si NO estamos en modo "solo menú del día"
      // Si solo hay menú del día, ya se mostró arriba (o se debería mostrar de forma especial)

      const isOnlyDailyMenuMode = activeDailyMenu && categories.length === 0

      if (!isOnlyDailyMenuMode) {
        html += renderCategorySection({ name: 'Todos los productos' }, filteredProducts)
      }
    }
  }
  else {
    // Vista plana (búsqueda o categoría específica normal)
    const sectionName = filteredCategoryId === 'all'
      ? `Resultados para "${searchQuery}"`
      : categories.find(c => c.id === filteredCategoryId)?.name || 'Productos'

    html += renderCategorySection({ name: sectionName }, filteredProducts, 'grid')
  }

  productsContainer.innerHTML = html

  // Re-attach event listeners
  attachProductCardListeners()
}

function attachProductCardListeners() {
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // No abrir modal si se hizo click en el botón de favoritos
      if (e.target.closest('.favorite-btn')) {
        return
      }

      const productId = e.currentTarget.dataset.id
      openProductModal(productId)
    })
  })
}


function renderCategorySection(category, categoryProducts, layout = 'row') {
  const containerClass = layout === 'grid' ? 'products-grid' : 'products-row'

  return `
    <div class="category-section">
      <h2>${category.name}</h2>
      <div class="${containerClass}">
        ${categoryProducts.map(renderProductCard).join('')}
      </div>
    </div>
  `
}

function renderProductCard(product) {
  const isFav = currentBusiness ? favorites.isFavorite(currentBusiness.id, product.id) : false
  const hasSizes = product.sizes && product.sizes.length > 0

  // Calculate pricing HTML based on sizes or discount
  let priceHTML = ''

  if (hasSizes) {
    // Get prices from sizes
    let prices = product.sizes.map(s => parseFloat(s.price))
    let originalPrices = [...prices] // Keep copy of original prices

    // Apply discount to all size prices if discount exists
    if (product.discount) {
      const discountPercentage = product.discount.discount_percentage
      prices = prices.map(p => p * (1 - discountPercentage / 100))
    }

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Show discount badge and crossed prices if has discount
    if (product.discount) {
      const originalMin = Math.min(...originalPrices)
      const originalMax = Math.max(...originalPrices)
      const discountPercentage = product.discount.discount_percentage

      priceHTML = `
        <div class="product-card-price-container">
          <div class="discounted-price">$${minPrice.toLocaleString()} ... $${maxPrice.toLocaleString()}</div>
          <div class="price-discount-wrapper">
            <span class="discount-badge">${discountPercentage}%</span>
            <span class="original-price">$${originalMin.toLocaleString()} ... $${originalMax.toLocaleString()}</span>
          </div>
        </div>
      `
    } else {
      priceHTML = `<div class="product-card-price-range">$${minPrice.toLocaleString()} ... $${maxPrice.toLocaleString()}</div>`
    }
  } else if (product.discount) {
    const originalPrice = parseFloat(product.price)
    const discountPercentage = product.discount.discount_percentage
    const discountedPrice = originalPrice * (1 - discountPercentage / 100)

    priceHTML = `
      <div class="product-card-price-container">
        <div class="discounted-price">$${discountedPrice.toLocaleString()}</div>
        <div class="price-discount-wrapper">
          <span class="discount-badge">${discountPercentage}%</span>
          <span class="original-price">$${originalPrice.toLocaleString()}</span>
        </div>
      </div>
    `
  } else {
    priceHTML = `<div class="product-card-price">$${parseFloat(product.price).toLocaleString()}</div>`
  }

  return `
    <div class="product-card${hasSizes ? ' has-sizes' : ''}" data-id="${product.id}">
      <div class="product-card-image">
        ${product.image_url
      ? `<img src="${product.image_url}" alt="${product.name}" loading="lazy">`
      : 'Sin imagen'
    }
        <button class="favorite-btn ${isFav ? 'active' : ''}"
                data-product-id="${product.id}">
          <i class="ri-heart-${isFav ? 'fill' : 'line'}"></i>
        </button>
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-footer">
          ${priceHTML}
          <button class="btn-add-to-modal" title="Ver detalles">
            <i class="ri-add-line"></i>
          </button>
        </div>
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

  updateUrl('product', productId)

  selectedProduct = products.find(p => p.id === productId)
  if (!selectedProduct) return

  currentQuantity = 1
  selectedQuickComments = []
  selectedSides = []
  selectedSize = null

  // If product has sizes, select the first one by default
  if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
    selectedSize = selectedProduct.sizes[0]
  }

  // Calculate final price (with discount if applicable or from selected size)
  let finalPrice = selectedSize ? parseFloat(selectedSize.price) : parseFloat(selectedProduct.price)
  let priceHTML = ''

  // ALWAYS apply discount if it exists (regardless of size)
  if (selectedProduct.discount) {
    const discountPercentage = selectedProduct.discount.discount_percentage
    const originalPrice = finalPrice
    finalPrice = finalPrice * (1 - discountPercentage / 100)

    // Show discount badge + original price + discounted price
    priceHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <span class="discount-badge" style="background: #fbbf24; color: #000; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">${discountPercentage}%</span>
        <span style="color: #6b7280; text-decoration: line-through; font-size: 0.875rem;">$${originalPrice.toLocaleString()}</span>
        <span style="color: var(--color-primary); font-weight: 700; font-size: 1.25rem;">$${finalPrice.toLocaleString()}</span>
      </div>
    `
  } else {
    priceHTML = `$${finalPrice.toLocaleString()}`
  }

  // Llenar modal
  productModalName.textContent = selectedProduct.name
  productModalPrice.innerHTML = priceHTML
  productModalDescription.textContent = selectedProduct.description || 'Sin descripción'
  quantityValue.textContent = currentQuantity

  // Update header title
  const productModalHeaderTitle = document.getElementById('productModalHeaderTitle')
  if (productModalHeaderTitle) {
    productModalHeaderTitle.textContent = selectedProduct.name
  }

  if (selectedProduct.image_url) {
    productModalImage.innerHTML = `<img src="${selectedProduct.image_url}" alt="${selectedProduct.name}">`
  } else {
    productModalImage.innerHTML = 'Sin imagen'
  }

  // Render size selector if product has sizes
  renderSizeSelector()

  // Cargar opciones del producto
  await loadProductOptionsCatalog(productId) // Renamed to avoid confusion/conflict
  renderProductOptions()

  productModal.style.display = 'flex'

  // Setup scroll listener for header title
  const productModalBody = document.querySelector('#productModal .product-modal-body')
  const productModalHeader = document.querySelector('#productModal .product-modal-header')

  if (productModalBody && productModalHeader) {
    productModalBody.addEventListener('scroll', function () {
      if (productModalBody.scrollTop > 50) {
        productModalHeader.classList.add('scrolled')
      } else {
        productModalHeader.classList.remove('scrolled')
      }
    })
  }
}

// Global variables for options (Catalog Scope)
let productOptionGroups = []
let ungroupedOptions = []

async function loadProductOptionsCatalog(productId) {
  try {
    console.group('🛒 Loading Options for Product:', productId)

    // Fetch Groups
    try {
      productOptionGroups = await productOptionsService.getGroupsByProduct(productId)
    } catch (err) {
      console.error('Error fetching groups:', err)
      productOptionGroups = []
    }
    console.log('📦 Groups fetched:', productOptionGroups)

    // Fetch All Options (to get ungrouped ones)
    let allOptions = []
    try {
      allOptions = await productOptionsService.getByProduct(productId)
    } catch (err) {
      console.error('Error fetching all options:', err)
      allOptions = []
    }

    // Filter ungrouped options: Include those with NO group_id OR those whose group_id doesn't match any loaded group
    const groupIds = productOptionGroups.map(g => g.id.toString())
    ungroupedOptions = allOptions.filter(opt => !opt.group_id || !groupIds.includes(opt.group_id.toString()))

    console.log('🔸 Ungrouped options:', ungroupedOptions)

    // For legacy headers logic in rendered function
    productOptions = ungroupedOptions // Maintain compatibility for legacy render parts if reused

    console.groupEnd()
  } catch (error) {
    console.error('❌ Critical Error loading product options:', error)
    console.groupEnd()
    productOptionGroups = []
    ungroupedOptions = []
    productOptions = []
  }
}

/**
 * Render size selector in product modal
 */
function renderSizeSelector() {
  // Find or create size selector container
  let sizeContainer = document.getElementById('sizeSelectorContainer')

  if (!sizeContainer) {
    // Create container and insert before options
    sizeContainer = document.createElement('div')
    sizeContainer.id = 'sizeSelectorContainer'
    sizeContainer.style.marginBottom = '1.5rem'

    // Insert before quick comments section
    const quickCommentsSection = document.getElementById('quickCommentsSection')
    if (quickCommentsSection && quickCommentsSection.parentNode) {
      quickCommentsSection.parentNode.insertBefore(sizeContainer, quickCommentsSection)
    }
  }

  // If no sizes, hide container
  if (!selectedProduct.sizes || selectedProduct.sizes.length === 0) {
    sizeContainer.innerHTML = ''
    sizeContainer.style.display = 'none'
    return
  }

  // Show container and render sizes
  sizeContainer.style.display = 'block'
  sizeContainer.innerHTML = `
    <div style="margin-bottom: 0.75rem;">
      <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem;">Selecciona el tamaño:</h4>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${selectedProduct.sizes.map(size => `
          <div class="size-option" style="display: flex; align-items: center; padding: 0.75rem; border: 2px solid ${selectedSize && selectedSize.id === size.id ? 'var(--color-primary)' : '#e5e7eb'}; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s;">
            <input 
              type="radio" 
              id="size-${size.id}" 
              name="productSize" 
              value="${size.id}"
              ${selectedSize && selectedSize.id === size.id ? 'checked' : ''}
              style="margin-right: 0.75rem; cursor: pointer;"
            >
            <label for="size-${size.id}" style="flex: 1; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin: 0;">
              <span style="font-weight: 500;">${size.name}</span>
              ${selectedProduct.discount ? `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="text-decoration: line-through; color: #6b7280; font-size: 0.85rem;">$${parseFloat(size.price).toLocaleString()}</span>
                  <span style="font-weight: 700; color: var(--color-primary);">$${(parseFloat(size.price) * (1 - selectedProduct.discount.discount_percentage / 100)).toLocaleString()}</span>
                </div>
              ` : `<span style="font-weight: 700; color: var(--color-primary);">$${parseFloat(size.price).toLocaleString()}</span>`}
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `

  // Add event listeners
  sizeContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        const sizeId = e.target.value
        selectedSize = selectedProduct.sizes.find(s => s.id === sizeId)

        // Update price (ALWAYS apply discount if exists)
        let newPrice = parseFloat(selectedSize.price)

        if (selectedProduct.discount) {
          const discountPercentage = selectedProduct.discount.discount_percentage
          const originalPrice = newPrice
          newPrice = newPrice * (1 - discountPercentage / 100)

          productModalPrice.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="discount-badge" style="background: #fbbf24; color: #000; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 700;">${discountPercentage}%</span>
              <span style="color: #6b7280; text-decoration: line-through; font-size: 0.875rem;">$${originalPrice.toLocaleString()}</span>
              <span style="color: var(--color-primary); font-weight: 700; font-size: 1.25rem;">$${newPrice.toLocaleString()}</span>
            </div>
          `
        } else {
          productModalPrice.innerHTML = `$${newPrice.toLocaleString()}`
        }

        // Re-render to update border colors
        renderSizeSelector()
      }
    })
  })
}

function renderProductOptions() {
  const optionsContainer = document.getElementById('optionsContainer') || createOptionsContainer()
  optionsContainer.innerHTML = '' // Clear existing

  // 1. Render Groups
  productOptionGroups.forEach(group => {
    const groupEl = document.createElement('div')
    groupEl.className = 'option-group-section'
    groupEl.dataset.groupId = group.id
    groupEl.dataset.type = group.type
    groupEl.dataset.min = group.min_selections
    groupEl.dataset.max = group.max_selections
    groupEl.style.marginBottom = '1.5rem'

    const requiredBadge = group.min_selections > 0 ? `<span style="color:red; font-size: 0.8rem; margin-left: 0.25rem;">* Obligatorio</span>` : ''
    const limitsLabel = group.type === 'checkbox' && group.max_selections > 0 ? `<span style="color:#6b7280; font-size: 0.8rem;">(Máx. ${group.max_selections})</span>` : ''
    const subtitle = group.type === 'radio' ? 'Selecciona una opción' : `Selecciona opciones ${limitsLabel}`

    groupEl.innerHTML = `
      <div style="margin-bottom: 0.5rem;">
        <h4 style="font-size: 1rem; font-weight: 600; color: #374151; margin: 0;">${group.name} ${requiredBadge}</h4>
        <p style="font-size: 0.85rem; color: #9ca3af; margin: 0;">${subtitle}</p>
      </div>
      <div class="group-options-list" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
    `

    const listContainer = groupEl.querySelector('.group-options-list')

    group.options.forEach(opt => {
      const optId = `opt-${opt.id}`
      const priceText = parseFloat(opt.price) > 0 ? `+$${parseFloat(opt.price).toLocaleString()}` : ''
      const inputType = group.type === 'radio' ? 'radio' : 'checkbox'
      const inputName = group.type === 'radio' ? `group-${group.id}` : `group-${group.id}[]`

      const itemEl = document.createElement('div')
      itemEl.className = 'option-item-wrapper'
      itemEl.innerHTML = `
        <input type="${inputType}" id="${optId}" name="${inputName}" value="${opt.id}" data-price="${opt.price}" data-name="${opt.name}" class="option-input">
        <label for="${optId}" class="option-label">
          <span style="font-weight: 500; color: #4b5563;">${opt.name}</span>
          <span style="font-weight: 600; color: var(--color-primary);">${priceText}</span>
        </label>
      `
      // Styling handled by CSS or existing classes
      listContainer.appendChild(itemEl)
    })

    optionsContainer.appendChild(groupEl)
  })


  // 2. Render Ungrouped Options (Legacy Quick Comments & Sides)
  // Use existing sections if they exist in HTML, or append to optionsContainer

  const quickComments = ungroupedOptions.filter(opt => opt.type === 'quick_comment')
  const sides = ungroupedOptions.filter(opt => opt.type === 'side')

  if (quickComments.length > 0) {
    const qcSection = document.createElement('div')
    qcSection.className = 'ungrouped-section mb-6'
    qcSection.innerHTML = `
      <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">Comentarios Rápidos</h4>
      <div class="quick-comments-list"></div>
    `
    const list = qcSection.querySelector('.quick-comments-list')
    quickComments.forEach(comment => {
      list.innerHTML += `
        <div class="quick-comment-option">
          <input type="checkbox" id="comment-${comment.id}" name="quickComment" value="${comment.id}" data-name="${comment.name}">
          <label for="comment-${comment.id}">${comment.name}</label>
        </div>
      `
    })
    optionsContainer.appendChild(qcSection)

    // Add legacy limit listener (Max 3)
    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const checked = list.querySelectorAll('input:checked').length
        if (checked > 3 && e.target.checked) {
          e.target.checked = false;
          notify.warning('Máximo 3 comentarios rápidos');
        }
      })
    })
  }

  if (sides.length > 0) {
    const sideSection = document.createElement('div')
    sideSection.className = 'ungrouped-section mb-6'
    sideSection.innerHTML = `
      <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">Acompañantes</h4>
      <div class="sides-list"></div>
    `
    const list = sideSection.querySelector('.sides-list')
    sides.forEach(side => {
      list.innerHTML += `
        <div class="side-option">
          <div class="side-option-left">
            <input type="checkbox" id="side-${side.id}" value="${side.id}" data-name="${side.name}" data-price="${side.price}">
            <label for="side-${side.id}" class="side-option-name">${side.name}</label>
          </div>
          <span class="side-option-price">+$${parseFloat(side.price).toLocaleString()}</span>
        </div>
      `
    })
    optionsContainer.appendChild(sideSection)
  }

  // Clean up legacy hardcoded sections if they exist to avoid duplication
  quickCommentsSection.classList.add('hidden')
  sidesSection.classList.add('hidden')
}

// Helper to ensure container exists
function createOptionsContainer() {
  const container = document.createElement('div')
  container.id = 'optionsContainer'
  container.style.marginTop = '1rem'
  // Insert after size selector
  const sizeContainer = document.getElementById('sizeSelectorContainer')
  if (sizeContainer && sizeContainer.parentNode) {
    sizeContainer.parentNode.insertBefore(container, sizeContainer.nextSibling)
  } else {
    // Fallback
    document.querySelector('.product-modal-body').appendChild(container)
  }
  return container
}


function closeProductModal() {
  clearUrl()
  productModal.style.display = 'none'
  selectedProduct = null
  productOptions = []
  productOptionGroups = []
  ungroupedOptions = []
  currentQuantity = 1
  selectedQuickComments = []
  selectedSides = []
  selectedSize = null

  // Reset visibility states
  quickCommentsSection.classList.add('hidden')
  sidesSection.classList.add('hidden')

  // Clear generated container
  const container = document.getElementById('optionsContainer')
  if (container) container.innerHTML = ''
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

  // 1. Validate and Collect Groups
  const collectedGroups = []
  const groupSections = document.querySelectorAll('.option-group-section')
  let validationError = null

  for (const groupEl of groupSections) {
    const groupId = groupEl.dataset.groupId
    const groupName = groupEl.querySelector('h4').innerText.split('*')[0].trim()
    const type = groupEl.dataset.type
    const min = parseInt(groupEl.dataset.min) || 0
    const max = parseInt(groupEl.dataset.max) || 0

    const inputs = groupEl.querySelectorAll('input:checked')
    const selectedCount = inputs.length

    if (selectedCount < min) {
      validationError = `Debes seleccionar al menos ${min} opción(es) en "${groupName}"`
      break
    }
    if (type === 'checkbox' && max > 0 && selectedCount > max) {
      validationError = `Puedes seleccionar máximo ${max} opción(es) en "${groupName}"`
      break
    }

    if (selectedCount > 0) {
      const selections = Array.from(inputs).map(inp => ({
        id: inp.value,
        name: inp.dataset.name,
        price: parseFloat(inp.dataset.price) || 0
      }))
      collectedGroups.push({
        id: groupId,
        name: groupName,
        selections: selections
      })
    }
  }

  if (validationError) {
    notify.warning(validationError)
    return
  }

  // 2. Collect Ungrouped (Legacy)
  const legacyQuickComments = []
  const qcInputs = document.querySelectorAll('.quick-comments-list input:checked')
  qcInputs.forEach(inp => {
    legacyQuickComments.push({
      id: inp.value,
      name: inp.dataset.name
    })
  })

  const legacySides = []
  const sideInputs = document.querySelectorAll('.sides-list input:checked')
  sideInputs.forEach(inp => {
    legacySides.push({
      id: inp.value,
      name: inp.dataset.name,
      price: parseFloat(inp.dataset.price) || 0
    })
  })

  const options = {
    groups: collectedGroups, // NEW: Grouped options
    quickComments: legacyQuickComments, // Legacy
    sides: legacySides, // Legacy
    size: selectedSize
  }

  // Guardar el nombre ANTES de cerrar el modal
  let productName = selectedProduct.name
  if (selectedSize) {
    productName = `${selectedProduct.name} - ${selectedSize.name}`
  }

  // Calculate final price (from selected size, or with discount if applicable)
  let finalPrice = selectedSize
    ? parseFloat(selectedSize.price)
    : parseFloat(selectedProduct.price)

  // ALWAYS apply discount if it exists
  if (selectedProduct.discount) {
    const discountPercentage = selectedProduct.discount.discount_percentage
    finalPrice = finalPrice * (1 - discountPercentage / 100)
  }

  // Create product object with final price
  const productToAdd = {
    ...selectedProduct,
    price: finalPrice,
    displayName: productName
  }

  cart.add(currentBusiness.id, productToAdd, currentQuantity, options)
  updateCartUI()
  closeProductModal()

  // Feedback visual con el nombre guardado
  notify.success(`${productName} agregado al carrito`, 2000)
})

// ============================================
// CART UI
// ============================================
function updateCartUI() {
  if (!currentBusiness) return
  const cartItems = cart.get(currentBusiness.id)
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
  // Check both explicit mobile style (flex) OR desktop state class (active cart)
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches
  const isMobileOpen = cartPanel.style.display === 'flex'
  // En desktop siempre queremos renderizar si hay items (updateCartUI se llama al agregar)
  // Pero para ser seguros, renderizamos si está abierto en móvil O si es desktop
  if (isMobileOpen || isDesktop) {
    renderCartItems()
  }

  // NEW: Update Dynamic Desktop Layout
  toggleDynamicCartLayout()
}

function toggleDynamicCartLayout() {
  const content = document.getElementById('catalogContent')
  if (!content) return

  // Check total items from cart service directly or DOM
  // We already calculated totalItems in updateCartUI, but let's re-fetch to be safe or use cart.totalItems if available.
  // The cart object wrapper might not have .totalItems property directly exposed in this scope context without re-calculating unless we rely on cart.get().
  // Let's rely on the cart service state.

  if (!currentBusiness) return
  const cartItems = cart.get(currentBusiness.id)
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  if (totalItems > 0) {
    content.classList.add('has-active-cart')
  } else {
    content.classList.remove('has-active-cart')
  }
}

function renderCartItems() {
  if (!currentBusiness) return
  const cartItems = cart.get(currentBusiness.id)

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

    // 1. Grupos de Opciones (New)
    if (item.options?.groups && item.options.groups.length > 0) {
      item.options.groups.forEach(group => {
        const selectionsText = group.selections.map(s => {
          return parseFloat(s.price) > 0 ? `${s.name} (+$${parseFloat(s.price).toLocaleString()})` : s.name
        }).join(', ')
        optionsText += `<div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;"><strong>${group.name}:</strong> ${selectionsText}</div>`
      })
    }

    // 2. Comentarios rápidos (Legacy)
    if (item.options?.quickComments && item.options.quickComments.length > 0) {
      item.options.quickComments.forEach(comment => {
        optionsText += `<div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">• ${comment.name}</div>`
      })
    } else if (item.options?.quickComment) {
      optionsText += `<div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">• ${item.options.quickComment.name}</div>`
    }

    // 3. Acompañantes (Legacy)
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
          <div class="cart-item-name">${item.options?.size ? `${item.name} - ${item.options.size.name}` : item.name}</div>
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
  // Total
  let total = cart.getTotal(currentBusiness.id)

  // Manejo del precio de domicilio
  const deliveryPrice = parseFloat(currentBusiness.delivery_price) || 0

  // Buscar o crear fila de domicilio
  let deliveryRow = document.getElementById('cartDeliveryRow')

  if (deliveryPrice > 0) {
    if (!deliveryRow) {
      deliveryRow = document.createElement('div')
      deliveryRow.id = 'cartDeliveryRow'
      deliveryRow.className = 'cart-delivery-row'
      deliveryRow.style.cssText = 'display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.9rem; color: #666; border-bottom: 1px dashed #eee; margin-bottom: 0.5rem;'

      const cartFooter = document.getElementById('cartFooter')
      const cartTotal = cartFooter.querySelector('.cart-total')
      cartFooter.insertBefore(deliveryRow, cartTotal)
    }

    deliveryRow.innerHTML = `
      <span><i class="ri-e-bike-2-fill"></i> Domicilio:</span>
      <span>$${deliveryPrice.toLocaleString()}</span>
    `
    deliveryRow.style.display = 'flex'

    // Sumar domicilio al total
    total += deliveryPrice
  } else if (deliveryRow) {
    deliveryRow.style.display = 'none'
  }

  cartTotalAmount.textContent = `$${total.toLocaleString()}`
  cartFooter.style.display = 'block'

  // Event listeners
  document.querySelectorAll('.cart-item-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemKey = e.target.dataset.key
      const item = cartItems.find(i => i.itemKey === itemKey)
      if (item && item.quantity > 1) {
        cart.updateQuantity(currentBusiness.id, itemKey, item.quantity - 1)
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
        cart.updateQuantity(currentBusiness.id, itemKey, item.quantity + 1)
        updateCartUI()
        renderCartItems()
      }
    })
  })

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemKey = e.target.dataset.key
      cart.remove(currentBusiness.id, itemKey)
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

  // --- GUARDAR PEDIDO EN AL BASE DE DATOS ---
  try {
    if (currentBusiness) {
      const cartItems = cart.get(currentBusiness.id)

      if (cartItems.length > 0) {
        // Calcular totales
        const deliveryPrice = parseFloat(currentBusiness.delivery_price) || 0
        const productsTotal = cartItems.reduce((sum, item) => {
          let price = parseFloat(item.price)
          if (item.options?.sides) {
            price += item.options.sides.reduce((s, side) => s + parseFloat(side.price), 0)
          }
          return sum + (price * item.quantity)
        }, 0)
        const totalAmount = productsTotal + deliveryPrice

        // Preparar datos de la orden
        const orderData = {
          business_id: currentBusiness.id,
          customer_name: clientData.nombre,
          customer_phone: clientData.telefono,
          customer_address: clientData.direccion,
          customer_neighborhood: clientData.barrio,
          order_notes: clientData.observaciones,
          delivery_price: deliveryPrice,
          total_amount: totalAmount,
          payment_method: clientData.metodo_pago,
          channel: 'whatsapp'
        }

        // Preparar items
        const orderItems = cartItems.map(item => {
          let unitPrice = parseFloat(item.price)

          // Incluir precio de acompañantes (Legacy)
          if (item.options?.sides) {
            unitPrice += item.options.sides.reduce((s, side) => s + parseFloat(side.price), 0)
          }

          // Incluir precio de grupos (New)
          if (item.options?.groups) {
            item.options.groups.forEach(group => {
              if (group.selections) {
                unitPrice += group.selections.reduce((s, sel) => s + parseFloat(sel.price), 0)
              }
            })
          }

          // Build options object properly
          const options = { ...(item.options || {}) }
          if (item.is_promotion) {
            options.promotion_id = item.id
          }

          return {
            product_id: item.is_promotion ? null : (item.id || null),
            product_name: item.options?.size ? `${item.name} - ${item.options.size.name}` : item.name,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: unitPrice * item.quantity,
            options: options,
            is_promotion: item.is_promotion || false
          }
        })

        // Crear orden en BD
        notify.info('Registrando pedido...', 1000)
        await ordersService.createOrder(orderData, orderItems)
      }
    }
  } catch (error) {
    console.error('Error saving order to DB:', error)
    // Mostrar error VISIBLE para poder depurar en móvil
    notify.error(`Error al registrar pedido: ${error.message || error.details || 'Error desconocido'}`)
    // OPCIONAL: Detener el flujo si queremos que NO vaya a WhatsApp si falla la BD
    // return 
  }
  // ------------------------------------------

  await sendWhatsAppOrder(clientData)
})

async function sendWhatsAppOrder(clientData) {
  if (!currentBusiness) return
  const cartItems = cart.get(currentBusiness.id)
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

      // Calcular precio con acompañantes (Legacy)
      if (item.options?.sides && item.options.sides.length > 0) {
        const sidesTotal = item.options.sides.reduce((sum, side) => sum + parseFloat(side.price), 0)
        itemPrice += sidesTotal
      }

      // Calcular precio de grupos (New)
      if (item.options?.groups) {
        item.options.groups.forEach(group => {
          if (group.selections) {
            itemPrice += group.selections.reduce((sum, sel) => sum + parseFloat(sel.price), 0)
          }
        })
      }

      const subtotal = itemPrice * item.quantity

      // Línea principal del producto
      let line = `- ${item.quantity}x ${item.options?.size ? `${item.name} - ${item.options.size.name}` : item.name} ($${subtotal.toLocaleString('es-CO')})`

      // Grupos de Opciones (New)
      if (item.options?.groups && item.options.groups.length > 0) {
        item.options.groups.forEach(group => {
          const selectionsText = group.selections.map(s => {
            return parseFloat(s.price) > 0 ? `${s.name} (+$${parseFloat(s.price).toLocaleString('es-CO')})` : s.name
          }).join(', ')
          line += `\n  ${group.name}: ${selectionsText}`
        })
      }

      // Comentarios rápidos (Multi y Single/Legacy support)
      if (item.options?.quickComments && item.options.quickComments.length > 0) {
        item.options.quickComments.forEach(comment => {
          line += `\n  ${comment.name}`
        })
      } else if (item.options?.quickComment) {
        line += `\n  ${item.options.quickComment.name}`
      }

      // Acompañantes
      if (item.options?.sides && item.options.sides.length > 0) {
        const sidesText = item.options.sides.map(s => `${s.name} (+$${parseFloat(s.price).toLocaleString('es-CO')})`).join(', ')
        line += `\n  Con: ${sidesText}`
      }

      return line
    })

    // Calcular total
    const productsTotal = cartItems.reduce((sum, item) => {
      let price = parseFloat(item.price)
      // Add sides price
      if (item.options?.sides) {
        price += item.options.sides.reduce((s, side) => s + parseFloat(side.price), 0)
      }
      // Add groups price
      if (item.options?.groups) {
        item.options.groups.forEach(group => {
          if (group.selections) {
            price += group.selections.reduce((s, sel) => s + parseFloat(sel.price), 0)
          }
        })
      }
      return sum + (price * item.quantity)
    }, 0)

    const deliveryPrice = parseFloat(currentBusiness.delivery_price) || 0
    const total = productsTotal + deliveryPrice

    const productsListStr = productsList.join('\n')

    // Reemplazar variables en la plantilla
    let message = template
      .replace('{productos}', productsListStr)
      .replace('{total}', `$${total.toLocaleString('es-CO')}`)
      .replace('{nombre}', clientData.nombre)
      .replace('{telefono}', clientData.telefono)
      .replace('{metodo_pago}', clientData.metodo_pago)
      .replace('{valor de domicilio}', `$${deliveryPrice.toLocaleString('es-CO')}`)

    // Si la plantilla no tiene el token {valor de domicilio} y hay domicilio, lo agregamos al final de los productos
    if (deliveryPrice > 0 && !template.includes('{valor de domicilio}')) {
      message = message.replace(productsListStr, `${productsListStr}\n🚚 Domicilio: $${deliveryPrice.toLocaleString('es-CO')}`)
    } // Reemplazo directo si existe el token

    // Lógica inteligente para dirección y barrio:
    // Si la plantilla YA incluía {barrio}, reemplazamos ambos tokens por separado
    // Si la plantilla NO incluía {barrio}, lo agregamos a la dirección para mantener compatibilidad.
    if (template.includes('{barrio}')) {
      message = message.replace(/{direccion}/g, clientData.direccion)
      message = message.replace(/{barrio}/g, clientData.barrio)
    } else {
      message = message.replace(/{direccion}/g, `${clientData.direccion}, ${clientData.barrio}`)
    }

    // Agregar observaciones si existen
    if (clientData.observaciones) {
      message += `\n\nObservaciones: ${clientData.observaciones}`
    }

    // Codificar y abrir WhatsApp
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${currentBusiness.whatsapp_number}?text=${encodedMessage}`

    // Cerrar modal de checkout inmediatamente
    closeCheckoutModal()
    // Cerrar panel del carrito
    cartPanel.style.display = 'none'

    // Opcional: Feedback visual de redirección
    const redirectModal = showRedirectModal()

    // Redirigir casi inmediatamente para evitar bloqueo de popups, 
    // pero dando un pequeño momento para que el usuario vea que algo pasa.
    // Usamos location.href que es más seguro para móviles/apps.
    setTimeout(() => {
      // Limpiar carrito antes de irnos si se desea, o dejarlo.
      // Si limpiamos aquí, cuando vuelvan estará vacío.
      if (currentBusiness) cart.clear(currentBusiness.id)
      updateCartUI()

      window.location.href = whatsappUrl

      // Remover modal despues de redirigir (aunque la página cambiará)
      setTimeout(() => {
        if (redirectModal) redirectModal.remove()
      }, 1000)
    }, 1500) // 1.5s delay max

  } catch (error) {
    console.error('Error sending WhatsApp order:', error)
    notify.error('Error al generar el pedido')
  }
}

// Validación de teléfono
const phoneInput = document.getElementById('clientPhone')
phoneInput?.addEventListener('input', (e) => {
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
// MODAL DE REDIRECCIÓN (Simplificado)
// ============================================
function showRedirectModal() {
  const modal = document.createElement('div')
  modal.className = 'redirect-modal'
  modal.innerHTML = `
    <div class="redirect-modal-content">
      <div class="redirect-icon">
        <i class="ri-whatsapp-line"></i>
      </div>
      <h2>Enviando a WhatsApp...</h2>
      <p>Por favor envía el mensaje pre-cargado para confirmar tu pedido.</p>
      <div class="redirect-spinner"></div>
    </div>
  `
  document.body.appendChild(modal)
  return modal
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
btnWhatsapp.addEventListener('click', async () => {
  if (!currentBusiness) return
  const cartItems = cart.get(currentBusiness.id)
  if (cartItems.length === 0) {
    notify.warning('El carrito está vacío')
    return
  }

  // Verificar si el negocio está abierto
  if (!businessStatus.isOpen) {
    showClosedModal()
    return
  }

  // NUEVO: Verificar límite de órdenes mensuales
  try {
    const limitCheck = await businessService.canCreateOrder(currentBusiness.id)
    if (!limitCheck.allowed) {
      showOrdersLimitModal(limitCheck)
      return
    }
  } catch (error) {
    console.error('Error checking orders limit:', error)
    // Si hay error verificando el límite, permitir continuar
    // (mejor fallar abierto que cerrado para el cliente)
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
      <h2>Estamos Cerrados</h2>
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

// Modal de límite de pedidos alcanzado
function showOrdersLimitModal(limitInfo) {
  const existingModal = document.getElementById('ordersLimitModal')
  if (existingModal) {
    existingModal.remove()
  }

  const modal = document.createElement('div')
  modal.id = 'ordersLimitModal'
  modal.className = 'closed-modal'
  modal.innerHTML = `
    <div class="closed-modal-overlay"></div>
    <div class="closed-modal-content">
      <div class="closed-modal-icon" style="background: #fef3c7;">
        <i class="ri-information-line" style="color: #f59e0b;"></i>
      </div>
      <h2>Pedido No Disponible</h2>
      <p>Lo sentimos, en este momento no podemos recibir nuevos pedidos.</p>
      <p style="margin-top: 0.5rem; color: #666;">Por favor, contacta directamente con el negocio para más información.</p>
      <button class="btn-primary" id="closeOrdersLimitModal">
        Entendido
      </button>
    </div>
  `

  document.body.appendChild(modal)

  const closeBtn = modal.querySelector('#closeOrdersLimitModal')
  const overlay = modal.querySelector('.closed-modal-overlay')

  closeBtn.addEventListener('click', () => modal.remove())
  overlay.addEventListener('click', () => modal.remove())
}



// ============================================
// HEADER SCROLL COMPRESSION (GSAP)
// ============================================
function initHeaderScrollCompression() {
  const headerContent = document.querySelector('.header-content')
  const logo = document.querySelector('.business-logo')
  const name = document.getElementById('businessName')
  const description = document.querySelector('.header-bottom-row')
  const statusBadge = document.getElementById('businessStatusBadge')

  if (!headerContent || !logo || !name || !description) return

  let isCompact = false

  // 🔥 TIMELINE ÚNICO con GSAP
  const tl = gsap.timeline({
    paused: true,
    defaults: { duration: 0.28, ease: "power2.out" }
  })

  // ESTADO COMPACTO
  tl.to(headerContent, {
    padding: "10px 16px",
    gap: 6
  }, 0)

    .to(logo, {
      width: 36,
      height: 36,
      borderRadius: 10
    }, 0)

    .to(name, {
      fontSize: "1.05rem"
    }, 0)

    .to(description, {
      opacity: 0,
      height: 0,
      marginTop: 0
    }, 0)

  // Animar el badge si existe
  if (statusBadge) {
    tl.to(statusBadge, {
      autoAlpha: 0,
      height: 0,
      padding: 0,
      margin: 0,
      overflow: 'hidden'
    }, 0)
  }

  // 👉 DISPARO ÚNICO AL PRIMER SCROLL
  window.addEventListener(
    'scroll',
    () => {
      if (!isCompact && window.scrollY > 0) {
        isCompact = true
        tl.play()
      }

      if (isCompact && window.scrollY === 0) {
        isCompact = false
        tl.reverse()
      }
    },
    { passive: true }
  )
}

// ============================================
// DEEP LINKING LOGIC
// ============================================

function updateUrl(type, id) {
  const url = new URL(window.location.href)

  // Limpiar parámetros previos
  url.searchParams.delete('product')
  url.searchParams.delete('promotion')

  // Agregar nuevo parámetro
  if (type === 'product') {
    url.searchParams.set('product', id)
  } else if (type === 'promotion') {
    url.searchParams.set('promotion', id)
  }

  // Actualizar URL sin recargar
  window.history.pushState({}, '', url)
}

function clearUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('product')
  url.searchParams.delete('promotion')
  window.history.replaceState({}, '', url)
}

function checkInitialUrl() {
  const urlParams = new URLSearchParams(window.location.search)
  const productId = urlParams.get('product')
  const promotionId = urlParams.get('promotion')

  if (productId) {
    // Buscar y abrir producto
    const product = products.find(p => p.id === productId)
    if (product) {
      openProductModal(productId)
    }
  } else if (promotionId) {
    // Buscar y abrir promoción
    const promo = promotions.find(p => p.id === promotionId)
    if (promo) {
      openPromotionModal(promo)
    }
  }
}



// ============================================
// SHARE FUNCTIONALITY
// ============================================

// Share Product
const productShareBtn = document.getElementById('productShareBtn')
if (productShareBtn) {
  productShareBtn.addEventListener('click', async () => {
    if (!selectedProduct) return

    const shareData = {
      title: selectedProduct.name,
      text: `${selectedProduct.name} - $${parseFloat(selectedProduct.price).toLocaleString()}${selectedProduct.description ? '\n' + selectedProduct.description : ''}`,
      url: window.location.href
    }

    await shareContent(shareData)
  })
}

// Share Promotion
const promotionShareBtn = document.getElementById('promotionShareBtn')
if (promotionShareBtn) {
  promotionShareBtn.addEventListener('click', async () => {
    if (!selectedPromotion) return

    const shareData = {
      title: selectedPromotion.title,
      text: `${selectedPromotion.title} - $${parseFloat(selectedPromotion.price).toLocaleString()}${selectedPromotion.description ? '\n' + selectedPromotion.description : ''}`,
      url: window.location.href
    }

    await shareContent(shareData)
  })
}

// Header Share Button
const headerShareBtn = document.getElementById('headerShareBtn')
if (headerShareBtn) {
  headerShareBtn.addEventListener('click', async () => {
    if (!currentBusiness) return

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('product')
    cleanUrl.searchParams.delete('promotion')

    const shareData = {
      title: currentBusiness.name,
      text: `Mira el catálogo de ${currentBusiness.name}`,
      url: cleanUrl.toString()
    }

    await shareContent(shareData)
  })
}

// Generic Share Function
async function shareContent(data) {
  // Check if Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share(data)
      notify.success('Contenido compartido', 2000)
    } catch (error) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error)
        fallbackShare(data)
      }
    }
  } else {
    // Fallback for browsers that don't support Web Share API
    fallbackShare(data)
  }
}

// Fallback: Copy link to clipboard
function fallbackShare(data) {
  const textToCopy = data.url

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        notify.success('Enlace copiado al portapapeles', 2000)
      })
      .catch(err => {
        console.error('Error copying to clipboard:', err)
        showShareModal(data)
      })
  } else {
    // Ultimate fallback for older browsers
    showShareModal(data)
  }
}

// Manual Share Modal (for very old browsers)
function showShareModal(data) {
  const modal = document.createElement('div')
  modal.className = 'share-modal'
  modal.innerHTML = `
    <div class="share-modal-overlay"></div>
    <div class="share-modal-content">
      <h3>Compartir</h3>
      <p style="margin: 1rem 0; color: #666; font-size: 0.9rem;">Copia el enlace para compartir:</p>
      <input 
        type="text" 
        value="${data.url}" 
        readonly 
        style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.9rem;"
        id="shareUrlInput"
      >
      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
        <button class="btn-secondary" id="closeShareModal" style="flex: 1;">Cerrar</button>
        <button class="btn-primary" id="copyShareUrl" style="flex: 1;">
          <i class="ri-file-copy-line"></i> Copiar
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  const input = modal.querySelector('#shareUrlInput')
  const closeBtn = modal.querySelector('#closeShareModal')
  const copyBtn = modal.querySelector('#copyShareUrl')
  const overlay = modal.querySelector('.share-modal-overlay')

  // Auto-select text
  input.select()

  copyBtn.addEventListener('click', () => {
    input.select()
    document.execCommand('copy')
    notify.success('Enlace copiado', 2000)
    modal.remove()
  })

  closeBtn.addEventListener('click', () => modal.remove())
  overlay.addEventListener('click', () => modal.remove())
}

// ============================================
// SCROLL ANIMATIONS
// ============================================
function initScrollAnimations() {
  // Select all elements that should animate on scroll
  const animatedElements = document.querySelectorAll('.product-card, .promo-slide')

  // Add the initial animation class to all elements
  animatedElements.forEach(el => {
    el.classList.add('fade-in-up')
  })

  // Create Intersection Observer
  const observerOptions = {
    root: null, // viewport
    rootMargin: '0px', // Trigger exactly when entering viewport
    threshold: 0 // Trigger as soon as 1px is visible
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Add animate-in class when element enters viewport
        entry.target.classList.add('animate-in')
        // Optional: Unobserve after animation to improve performance
        observer.unobserve(entry.target)
      }
    })
  }, observerOptions)

  // Observe all animated elements
  animatedElements.forEach(el => {
    observer.observe(el)
  })
}

// ============================================
// FAVORITES SYSTEM
// ============================================

// State for favorites filter
let showingFavorites = false
let favoritesInitialized = false

/**
 * Initialize favorites system
 */
function initFavorites() {
  // Add favorites button to categories navigation
  addFavoritesButton()

  // Add event delegation for favorite buttons on product cards (only once)
  if (!favoritesInitialized) {
    document.addEventListener('click', handleFavoriteClick)
    favoritesInitialized = true
  }
}

/**
 * Check if favorites button should be shown
 */
function shouldShowFavoritesButton() {
  if (!currentBusiness) return false

  const favoritesForBusiness = favorites.get(currentBusiness.id)
  // Filter only favorites that actually exist in current products
  const validFavorites = favoritesForBusiness.filter(favId =>
    products.some(p => p.id === favId)
  )

  return validFavorites.length > 0
}

/**
 * Update favorites button visibility dynamically
 */
function updateFavoritesButtonVisibility() {
  const categoriesNav = document.getElementById('categoriesNav')
  if (!categoriesNav) return

  const track = categoriesNav.querySelector('.categories-nav-track')
  if (!track) return

  const existingBtn = track.querySelector('[data-category="favorites"]')
  const shouldShow = shouldShowFavoritesButton()

  if (shouldShow && !existingBtn) {
    // Create the button if it doesn't exist
    addFavoritesButton()
  } else if (!shouldShow && existingBtn) {
    // Remove the button if it exists
    existingBtn.remove()
  }
}

/**
 * Add Favorites button to categories navigation
 */
function addFavoritesButton() {
  const categoriesNav = document.getElementById('categoriesNav')
  if (!categoriesNav) return

  const track = categoriesNav.querySelector('.categories-nav-track')
  if (!track) return

  // Check if button already exists
  if (track.querySelector('[data-category="favorites"]')) return

  // Only show button if user has valid favorites for this business
  if (!shouldShowFavoritesButton()) return

  // Create favorites button
  const favBtn = document.createElement('button')
  favBtn.className = 'category-nav-btn category-nav-favoritos'
  favBtn.dataset.category = 'favorites'
  favBtn.innerHTML = '<i class="ri-heart-fill"></i> Favoritos'

  // Insert after "Imperdibles" if it exists, otherwise after "Todos"
  const imperdiblesBtn = track.querySelector('[data-category="imperdibles"]')
  const todosBtn = track.querySelector('[data-category="all"]')

  if (imperdiblesBtn && imperdiblesBtn.nextSibling) {
    track.insertBefore(favBtn, imperdiblesBtn.nextSibling)
  } else if (todosBtn && todosBtn.nextSibling) {
    track.insertBefore(favBtn, todosBtn.nextSibling)
  } else {
    track.appendChild(favBtn)
  }

  // Add click handler
  favBtn.addEventListener('click', toggleFavoritesFilter)
}

/**
 * Handle favorite button clicks (event delegation)
 */
async function handleFavoriteClick(e) {
  const favoriteBtn = e.target.closest('.favorite-btn')
  if (!favoriteBtn) return

  e.preventDefault()
  e.stopPropagation()

  if (!currentBusiness) return

  const productId = favoriteBtn.dataset.productId
  if (!productId) return

  // Toggle favorite
  const isNowFavorite = await favorites.toggle(currentBusiness.id, productId)

  // Update button appearance
  updateFavoriteButton(favoriteBtn, isNowFavorite)

  // Update favorites category button visibility
  updateFavoritesButtonVisibility()

  // Show feedback
  const product = products.find(p => p.id === productId)
  if (product) {
    if (isNowFavorite) {
      notify.success(`❤️ ${product.name} añadido a favoritos`, 2000)
    } else {
      notify.success(`${product.name} quitado de favoritos`, 2000)
    }
  }
}

/**
 * Update favorite button appearance
 */
function updateFavoriteButton(btn, isFavorite) {
  const icon = btn.querySelector('i')

  if (isFavorite) {
    btn.classList.add('active')
    icon.className = 'ri-heart-fill'
  } else {
    btn.classList.remove('active')
    icon.className = 'ri-heart-line'
  }

  // Add animation
  btn.classList.add('animating')
  setTimeout(() => btn.classList.remove('animating'), 400)
}

/**
 * Enhance existing product cards with favorite buttons
 */
function enhanceProductsWithFavorites() {
  const container = document.getElementById('productsContainer')
  if (!container) return

  const observer = new MutationObserver(() => {
    addFavoriteButtonsToExistingCards()
  })

  observer.observe(container, { childList: true, subtree: true })

  // Also add to existing cards immediately
  addFavoriteButtonsToExistingCards()
}

/**
 * Add favorite buttons to existing product cards
 */
function addFavoriteButtonsToExistingCards() {
  if (!currentBusiness) return

  const productCards = document.querySelectorAll('.product-card')

  productCards.forEach(card => {
    // Skip if already has favorite button
    if (card.querySelector('.favorite-btn')) return

    const productId = card.dataset.productId || card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]
    if (!productId) return

    const imageContainer = card.querySelector('.product-card-image')
    if (!imageContainer) return

    const isFav = favorites.isFavorite(currentBusiness.id, productId)

    // Create button
    const favBtn = document.createElement('button')
    favBtn.className = `favorite-btn ${isFav ? 'active' : ''}`
    favBtn.dataset.productId = productId
    favBtn.innerHTML = `<i class="ri-heart-${isFav ? 'fill' : 'line'}"></i>`
    favBtn.onclick = (e) => e.stopPropagation()

    imageContainer.appendChild(favBtn)
  })
}

/**
 * Toggle favorites filter
 */
function toggleFavoritesFilter(e) {
  e.preventDefault()

  const favBtn = e.currentTarget
  const allButtons = document.querySelectorAll('.category-nav-btn')

  // Toggle all category buttons
  allButtons.forEach(btn => btn.classList.remove('active'))
  favBtn.classList.add('active')

  // Get favorite product IDs
  const favoriteIds = favorites.get(currentBusiness.id)

  if (favoriteIds.length === 0) {
    // Show empty state
    const container = document.getElementById('productsContainer')
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #9ca3af;">
          <i class="ri-heart-line" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No tienes favoritos aún</p>
          <p style="font-size: 0.9rem;">Marca tus productos favoritos con el ❤️ para verlos aquí</p>
        </div>
      `
    }
    return
  }

  // Filter products that are in favorites
  const favoriteProducts = products.filter(p => favoriteIds.includes(p.id))

  // Render only favorite products
  const container = document.getElementById('productsContainer')
  if (container) {
    const html = `
      <div class="category-section">
        <h2>❤️ Mis Favoritos</h2>
        <div class="products-grid">
          ${favoriteProducts.map(renderProductCard).join('')}
        </div>
      </div>
    `
    container.innerHTML = html

    // Re-attach click listeners to product cards
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // No abrir modal si se hizo click en el botón de favoritos o el botón de añadir
        if (e.target.closest('.favorite-btn') || e.target.closest('.btn-add-to-modal')) {
          return
        }

        const productId = e.currentTarget.dataset.id
        openProductModal(productId)
      })
    })

    // Re-apply scroll animations if needed
    initScrollAnimations()
  }
}

/**
 * Limpiar carritos de negocios no visitados recientemente
 * Ejecutar después de cargar el negocio actual
 */
function cleanOldCarts() {
  if (!currentBusiness) return

  const currentKey = `catalog_cart_${currentBusiness.id}`
  const maxDaysInactive = 7

  try {
    // Iterar todas las claves de localStorage
    Object.keys(localStorage).forEach(key => {
      // Solo procesar claves de carritos
      if (key.startsWith('catalog_cart_') && key !== currentKey) {
        const lastAccessKey = `${key}_last_access`
        const lastAccess = localStorage.getItem(lastAccessKey)

        const daysSinceAccess = lastAccess
          ? (Date.now() - parseInt(lastAccess)) / (1000 * 60 * 60 * 24)
          : 999

        // Eliminar si no se ha accedido en maxDaysInactive días
        if (daysSinceAccess > maxDaysInactive) {
          localStorage.removeItem(key)
          localStorage.removeItem(lastAccessKey)
          console.log(`Cleaned old cart: ${key}`)
        }
      }
    })

    // Registrar última visita al carrito actual
    localStorage.setItem(`${currentKey}_last_access`, Date.now().toString())
  } catch (error) {
    console.error('Error cleaning old carts:', error)
  }
}