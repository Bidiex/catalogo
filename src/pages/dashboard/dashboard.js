import { authService } from '../../services/auth.js'
import { generateOrderInvoice } from '../../utils/invoiceGenerator.js'

import { businessService } from '../../services/business.js'
import { categoryService } from '../../services/categories.js'
import { productService } from '../../services/products.js'
import { paymentMethodsService } from '../../services/paymentMethods.js'
import { businessHoursService } from '../../services/businessHours.js'
import { notify } from '../../utils/notifications.js'
import { confirm } from '../../utils/notifications.js'
import { buttonLoader } from '../../utils/buttonLoader.js'
import { supabase } from '../../config/supabase.js'
import { productOptionsService } from '../../services/productOptions.js'
import { productDiscountsService } from '../../services/productDiscounts.js'
import { productSizesService } from '../../services/productSizes.js'
import { promotionsService } from '../../services/promotions.js'
import { promotionOptionsService } from '../../services/promotionOptions.js'
import { imageService } from '../../services/images.js'
import { supportService } from '../../services/support.js'
import { ordersService } from '../../services/orders.js'
import { deliveryPersonsService } from '../../services/deliveryPersons.js'
import { initAnalytics, updateAnalytics } from './analytics.js'
import * as XLSX from 'xlsx'
// ============================================
// ESTADO GLOBAL
// ============================================
let currentUser = null
let currentBusiness = null
let categories = []
let products = []
let paymentMethods = []
let businessHours = []
let editingCategory = null
let editingProduct = null
let editingPaymentMethod = null
// Promotions state
let promotions = []
let editingPromotion = null
let currentPromotionImage = null
let supportTickets = [] // Global state for tickets
// Orders State
let orders = []
let ordersCurrentPage = 1
let ordersItemsPerPage = 20
let ordersTotalCount = 0
let currentOrderFilter = 'all'
let currentOrdersView = 'table' // 'table' or 'mosaic'
let deliveryPersons = []
let editingDeliveryPerson = null

// Wizard onboarding logo
let wizardLogoUrl = null

// ============================================
// ONBOARDING WIZARD - LOGO UPLOAD
// ============================================
const wizLogoPreview = document.getElementById('wiz-logo-preview')
const wizLogoInput = document.getElementById('wiz-logo-input')
const wizLogoActions = document.getElementById('wiz-logo-actions')
const wizLogoProgress = document.getElementById('wiz-logo-progress')
const wizLogoUrlHidden = document.getElementById('wiz-logo-url-hidden')
const wizChangeLogoBtn = document.getElementById('wiz-change-logo')
const wizRemoveLogoBtn = document.getElementById('wiz-remove-logo')

if (wizLogoPreview) {
  wizLogoPreview.addEventListener('click', () => {
    wizLogoInput.click()
  })
}

if (wizChangeLogoBtn) {
  wizChangeLogoBtn.addEventListener('click', () => {
    wizLogoInput.click()
  })
}

if (wizRemoveLogoBtn) {
  wizRemoveLogoBtn.addEventListener('click', () => {
    resetWizardLogoUpload()
  })
}

if (wizLogoInput) {
  wizLogoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.match('image/(jpeg|jpg|png|webp)')) {
      notify.error('Solo se permiten archivos JPG, PNG o WEBP')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      notify.error('El archivo debe pesar menos de 2MB')
      return
    }

    const progressDiv = wizLogoProgress
    const progressBar = progressDiv.querySelector('.progress-fill')
    progressDiv.style.display = 'flex'
    progressBar.style.width = '0%'

    try {
      const resizedFile = await imageService.resizeImage(file, 512, 512, 0.9)
      progressBar.style.width = '50%'

      const result = await imageService.upload(resizedFile, 'businesses')

      if (result.success) {
        progressBar.style.width = '100%'
        wizardLogoUrl = result.url
        wizLogoUrlHidden.value = result.url

        wizLogoPreview.innerHTML = `<img src="${result.url}" alt="Logo" style="object-fit:cover; width:100%; height:100%; border-radius:8px;">`
        wizLogoPreview.classList.add('has-image')
        wizLogoActions.style.display = 'flex'

        setTimeout(() => {
          progressDiv.style.display = 'none'
        }, 500)

        notify.success('Logo cargado correctamente', 2000)
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      notify.error('Error al cargar el logo')
      progressDiv.style.display = 'none'
    }
  })
}

function resetWizardLogoUpload() {
  wizardLogoUrl = null
  wizLogoUrlHidden.value = ''
  wizLogoInput.value = ''
  wizLogoPreview.innerHTML = `
    <i class="ri-image-line"></i>
    <p>Click para seleccionar logo</p>
    <small>JPG, PNG o WEBP (máx. 2MB)</small>
  `
  wizLogoPreview.classList.remove('has-image')
  wizLogoActions.style.display = 'none'
}

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const loadingState = document.getElementById('loadingState')
const noBusinessState = document.getElementById('noBusinessState')
const businessExistsState = document.getElementById('businessExistsState')

const userEmailSpan = document.getElementById('userEmail')
const logoutBtn = document.getElementById('logoutBtn')

const businessName = document.getElementById('businessName')
const businessWhatsapp = document.getElementById('businessWhatsapp')
const catalogLink = document.getElementById('catalogLink')
const copyLinkBtn = document.getElementById('copyLinkBtn')

const addCategoryBtn = document.getElementById('addCategoryBtn')
const addProductBtn = document.getElementById('addProductBtn')

const categoriesList = document.getElementById('categoriesList')
const productsList = document.getElementById('productsList')

// Modales
const businessModal = document.getElementById('businessModal')
const categoryModal = document.getElementById('categoryModal')
const productModal = document.getElementById('productModal')

// ============================================
// INICIALIZACIÓN
// ============================================
init()

async function init() {
  try {
    // Verificar autenticación
    const session = await authService.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    // Clean URL hash to prevent "session stale" warnings on reload
    if (window.location.hash && window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    currentUser = await authService.getCurrentUser()
    userEmailSpan.textContent = currentUser.email

    // Inicializar navegación del sidebar
    initSidebarNavigation()

    // Inicializar menú móvil
    initMobileMenu()

    // Inicializar soporte
    initSupport()

    // Inicializar pedidos
    // Inicializar pedidos
    initOrders()
    initOrderExport()

    // Inicializar domiciliarios
    initDeliveryPersons()

    // Cargar negocio
    await loadBusiness()

    // Show Reminder Modal - Only on fresh login, not on page refresh
    const reminderModal = document.getElementById('whatsappReminderModal')
    const closeReminderBtn = document.getElementById('closeReminderModalBtn')

    if (reminderModal && closeReminderBtn) {
      // Check if user just logged in
      const justLoggedIn = sessionStorage.getItem('justLoggedIn')

      if (justLoggedIn) {
        reminderModal.style.display = 'flex'
        // Immediately remove the flag so it won't show on refresh
        sessionStorage.removeItem('justLoggedIn')
      }

      closeReminderBtn.addEventListener('click', () => {
        reminderModal.style.display = 'none'
      })
    }

    // Check orders limit - Only on fresh login
    const justLoggedIn = sessionStorage.getItem('justLoggedIn')
    if (justLoggedIn && currentBusiness) {
      await checkAndShowOrdersLimitWarning()
    }

  } catch (error) {
    console.error('Error initializing dashboard:', error)
    notify.error('Error al cargar el dashboard')
  }
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================
function initSidebarNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-section]')

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const section = item.dataset.section

      // Remover active de todos los nav items
      navItems.forEach(nav => nav.classList.remove('active'))
      // Agregar active al item clickeado
      item.classList.add('active')

      // Verificar límite de pedidos al hacer clic en "Pedidos"
      if (section === 'orders' && currentBusiness) {
        checkAndShowOrdersLimitWarning()
        loadOrders()
      }

      if (section === 'delivery-persons' && currentBusiness) {
        loadDeliveryPersons()
      }

      // Cambiar sección
      switchSection(section)
    })
  })

  // Por defecto mostrar Dashboard
  switchSection('dashboard')

  // Inicializar búsquedas
  initSearchFunctionality()

  // Inicializar carga de logo
  initBusinessLogoUpload()

  // Inicializar carga de imagen de fondo del header
  initHeaderBackgroundUpload()

  // Inicializar editor de WhatsApp
  initWhatsAppEditor()

  // Inicializar personalización de color
  initColorCustomization()
}

// ============================================
// MOBILE MENU NAVIGATION
// ============================================
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn')
  const dashboardSidebar = document.querySelector('.dashboard-sidebar')
  const dashboardOverlay = document.getElementById('dashboardOverlay')
  const navItems = document.querySelectorAll('.nav-item')

  function toggleMenu() {
    dashboardSidebar.classList.toggle('active')
    dashboardOverlay.classList.toggle('active')
  }

  function closeMenu() {
    dashboardSidebar.classList.remove('active')
    dashboardOverlay.classList.remove('active')
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleMenu()
    })
  }

  if (dashboardOverlay) {
    dashboardOverlay.addEventListener('click', closeMenu)
  }

  // Close when clicking nav items on mobile
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        closeMenu()
      }
    })
  })

  // Close when clicking outside (extra safety)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 &&
      dashboardSidebar &&
      dashboardSidebar.classList.contains('active') &&
      !dashboardSidebar.contains(e.target) &&
      !mobileMenuBtn.contains(e.target)) {
      closeMenu()
    }
  })
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
function initSearchFunctionality() {
  // Búsqueda de categorías
  const searchCategoriesInput = document.getElementById('searchCategoriesInput')
  const clearCategoriesSearch = document.getElementById('clearCategoriesSearch')

  if (searchCategoriesInput && clearCategoriesSearch) {
    searchCategoriesInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase()

      if (query) {
        clearCategoriesSearch.style.display = 'flex'
        const filtered = categories.filter(cat =>
          cat.name.toLowerCase().includes(query)
        )
        renderCategories(filtered)
      } else {
        clearCategoriesSearch.style.display = 'none'
        renderCategories()
      }
    })

    clearCategoriesSearch.addEventListener('click', () => {
      searchCategoriesInput.value = ''
      clearCategoriesSearch.style.display = 'none'
      renderCategories()
      searchCategoriesInput.focus()
    })
  }

  // Búsqueda de productos
  const searchProductsInput = document.getElementById('searchProductsInput')
  const clearProductsSearch = document.getElementById('clearProductsSearch')

  if (searchProductsInput && clearProductsSearch) {
    searchProductsInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase()

      if (query) {
        clearProductsSearch.style.display = 'flex'
        const filtered = products.filter(prod =>
          prod.name.toLowerCase().includes(query) ||
          (prod.categories?.name && prod.categories.name.toLowerCase().includes(query)) ||
          (prod.description && prod.description.toLowerCase().includes(query))
        )
        renderProducts(filtered)
      } else {
        clearProductsSearch.style.display = 'none'
        renderProducts()
      }
    })

    clearProductsSearch.addEventListener('click', () => {
      searchProductsInput.value = ''
      clearProductsSearch.style.display = 'none'
      renderProducts()
      searchProductsInput.focus()
    })
  }

  // ============================================
  // Búsqueda y Paginación de Pedidos
  // ============================================
  const searchOrdersInput = document.getElementById('searchOrdersInput')
  const clearOrdersSearch = document.getElementById('clearOrdersSearch')
  const filterOrdersStatus = document.getElementById('filterOrdersStatus')
  const prevOrdersBtn = document.getElementById('prevOrdersPageBtn')
  const nextOrdersBtn = document.getElementById('nextOrdersPageBtn')

  let ordersDebounceTimer

  if (searchOrdersInput && clearOrdersSearch) {
    searchOrdersInput.addEventListener('input', (e) => {
      if (e.target.value.trim()) {
        clearOrdersSearch.style.display = 'flex'
      } else {
        clearOrdersSearch.style.display = 'none'
      }

      clearTimeout(ordersDebounceTimer)
      ordersDebounceTimer = setTimeout(() => {
        loadOrders(1) // Reset to page 1
      }, 500)
    })

    clearOrdersSearch.addEventListener('click', () => {
      searchOrdersInput.value = ''
      clearOrdersSearch.style.display = 'none'
      loadOrders(1)
    })
  }

  // Filter Pills
  const filterPills = document.querySelectorAll('.filter-pill')
  if (filterPills.length > 0) {
    filterPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        // Remove active class from all
        filterPills.forEach(p => p.classList.remove('active'))
        // Add active to clicked
        e.currentTarget.classList.add('active')

        // Update state
        currentOrderFilter = e.currentTarget.dataset.status

        // Load orders
        loadOrders(1)
      })
    })
  }

  if (prevOrdersBtn) {
    prevOrdersBtn.addEventListener('click', () => {
      if (ordersCurrentPage > 1) {
        loadOrders(ordersCurrentPage - 1)
      }
    })
  }

  if (nextOrdersBtn) {
    nextOrdersBtn.addEventListener('click', () => {
      const maxPages = Math.ceil(ordersTotalCount / ordersItemsPerPage)
      if (ordersCurrentPage < maxPages) {
        loadOrders(ordersCurrentPage + 1)
      }
    })
  }
}

function initBusinessLogoUpload() {
  const businessLogoDisplay = document.getElementById('business-logo-display')
  const businessLogoInput = document.getElementById('business-logo-input')
  const changeBusinessLogoBtn = document.getElementById('changeBusinessLogoBtn')
  const logoUploadProgress = document.getElementById('logo-upload-progress')

  if (businessLogoDisplay) {
    businessLogoDisplay.addEventListener('click', () => {
      businessLogoInput.click()
    })
  }

  if (changeBusinessLogoBtn) {
    changeBusinessLogoBtn.addEventListener('click', () => {
      businessLogoInput.click()
    })
  }

  if (businessLogoInput) {
    businessLogoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return

      if (!file.type.match('image/(jpeg|jpg|png|webp)')) {
        notify.error('Solo se permiten archivos JPG, PNG o WEBP')
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        notify.error('El archivo debe pesar menos de 2MB')
        return
      }

      // Show progress
      if (logoUploadProgress) {
        logoUploadProgress.style.display = 'block'
        const bar = logoUploadProgress.querySelector('.progress-fill')
        if (bar) bar.style.width = '0%'
      }

      try {
        // Resize image
        const resizedFile = await imageService.resizeImage(file, 512, 512, 0.9)

        if (logoUploadProgress) {
          const bar = logoUploadProgress.querySelector('.progress-fill')
          if (bar) bar.style.width = '50%'
        }

        const result = await imageService.upload(resizedFile, 'businesses')

        if (result.success) {
          if (logoUploadProgress) {
            const bar = logoUploadProgress.querySelector('.progress-fill')
            if (bar) bar.style.width = '100%'
          }

          // Update business with new logo
          await businessService.updateBusiness(currentBusiness.id, { logo_url: result.url })

          currentBusiness.logo_url = result.url
          renderBusinessInfo()
          notify.success('Logo actualizado correctamente')

          setTimeout(() => {
            if (logoUploadProgress) logoUploadProgress.style.display = 'none'
          }, 500)
        }
      } catch (error) {
        console.error('Error updating logo:', error)
        notify.error('Error al actualizar el logo')
        if (logoUploadProgress) logoUploadProgress.style.display = 'none'
      }
    })
  }
}

function initHeaderBackgroundUpload() {
  const headerBgPreview = document.getElementById('header-bg-preview')
  const headerBgInput = document.getElementById('header-bg-input')
  const uploadHeaderBgBtn = document.getElementById('uploadHeaderBgBtn')
  const removeHeaderBgBtn = document.getElementById('removeHeaderBgBtn')
  const headerBgUploadProgress = document.getElementById('header-bg-upload-progress')

  if (headerBgPreview) {
    headerBgPreview.addEventListener('click', () => {
      headerBgInput.click()
    })
  }

  if (uploadHeaderBgBtn) {
    uploadHeaderBgBtn.addEventListener('click', () => {
      headerBgInput.click()
    })
  }

  if (removeHeaderBgBtn) {
    removeHeaderBgBtn.addEventListener('click', async () => {
      const result = await confirm.show({
        title: '¿Eliminar imagen de fondo?',
        message: 'La imagen se eliminará permanentemente del header.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      })

      if (!result) return

      try {
        const oldImageUrl = currentBusiness.header_background_url

        // Update business - set to null first
        await businessService.updateBusiness(currentBusiness.id, { header_background_url: null })
        currentBusiness.header_background_url = null
        renderBusinessInfo()
        notify.success('Imagen de fondo eliminada')

        // Delete from storage in background (don't await to avoid blocking UI)
        if (oldImageUrl) {
          // Extract path from URL
          let path = oldImageUrl
          if (oldImageUrl.includes('product-images/')) {
            const parts = oldImageUrl.split('product-images/')
            path = parts[1] || oldImageUrl
          }

          // Delete from storage
          supabase.storage
            .from('product-images')
            .remove([path])
            .catch(err => console.warn('Could not delete old image from storage:', err))
        }
      } catch (error) {
        console.error('Error removing header background:', error)
        notify.error('Error al eliminar la imagen')
      }
    })
  }

  if (headerBgInput) {
    headerBgInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return

      if (!file.type.match('image/(jpeg|jpg|png|webp)')) {
        notify.error('Solo se permiten archivos JPG, PNG o WEBP')
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        notify.error('El archivo debe pesar menos de 2MB')
        return
      }

      // Show progress
      if (headerBgUploadProgress) {
        headerBgUploadProgress.style.display = 'block'
        const bar = headerBgUploadProgress.querySelector('.progress-fill')
        if (bar) bar.style.width = '0%'
      }

      try {
        // Resize image to header size (wider aspect ratio)
        const resizedFile = await imageService.resizeImage(file, 1200, 400, 0.85)

        if (headerBgUploadProgress) {
          const bar = headerBgUploadProgress.querySelector('.progress-fill')
          if (bar) bar.style.width = '50%'
        }

        const result = await imageService.upload(resizedFile, 'business-headers')

        if (result.success) {
          if (headerBgUploadProgress) {
            const bar = headerBgUploadProgress.querySelector('.progress-fill')
            if (bar) bar.style.width = '100%'
          }

          // Delete old image if exists
          if (currentBusiness.header_background_url) {
            await imageService.delete(currentBusiness.header_background_url)
          }

          // Update business with new header background
          await businessService.updateBusiness(currentBusiness.id, { header_background_url: result.url })

          currentBusiness.header_background_url = result.url
          renderBusinessInfo()
          notify.success('Imagen de fondo actualizada')

          setTimeout(() => {
            if (headerBgUploadProgress) headerBgUploadProgress.style.display = 'none'
          }, 500)
        }
      } catch (error) {
        console.error('Error updating header background:', error)
        notify.error('Error al actualizar la imagen de fondo')
        if (headerBgUploadProgress) headerBgUploadProgress.style.display = 'none'
      }

      // Clear input
      headerBgInput.value = ''
    })
  }
}

function initColorCustomization() {
  const openColorModalBtn = document.getElementById('openColorModalBtn')
  const customizeColorModal = document.getElementById('customizeColorModal')
  const closeColorModalBtn = document.getElementById('closeColorModalBtn')
  const cancelColorBtn = document.getElementById('cancelColorBtn')
  const saveColorBtn = document.getElementById('saveColorBtn')
  const colorOptions = document.querySelectorAll('.color-option')
  const previewColorCircle = document.getElementById('previewColorCircle')
  const previewColorCode = document.getElementById('previewColorCode')

  let selectedColor = '#4ced17' // Default

  function openModal() {
    selectedColor = currentBusiness.primary_color || '#4ced17'
    updateSelectionUI()
    customizeColorModal.style.display = 'flex'
  }

  function closeModal() {
    customizeColorModal.style.display = 'none'
  }

  function updateSelectionUI() {
    // Update Grid
    colorOptions.forEach(btn => {
      const color = btn.dataset.color
      if (color === selectedColor) {
        btn.classList.add('active')
        btn.style.transform = 'scale(1.15)'
        btn.style.borderColor = '#374151'
      } else {
        btn.classList.remove('active')
        btn.style.transform = 'scale(1)'
        btn.style.borderColor = '#e5e7eb'
      }
    })

    // Update Preview
    if (previewColorCircle) previewColorCircle.style.backgroundColor = selectedColor
    if (previewColorCode) previewColorCode.textContent = selectedColor
  }

  if (openColorModalBtn) {
    console.log('Attaching click listener to openColorModalBtn')
    openColorModalBtn.addEventListener('click', openModal)
  }

  if (closeColorModalBtn) closeColorModalBtn.addEventListener('click', closeModal)
  if (cancelColorBtn) cancelColorBtn.addEventListener('click', closeModal)

  if (saveColorBtn) {
    saveColorBtn.addEventListener('click', async () => {
      try {
        await buttonLoader.execute(saveColorBtn, async () => {
          await businessService.updateBusiness(currentBusiness.id, { primary_color: selectedColor })
          currentBusiness.primary_color = selectedColor
          notify.success('Color actualizado correctamente')
          closeModal()
        }, 'Guardando...')
      } catch (error) {
        console.error('Error saving color:', error)
        notify.error('Error al guardar el color')
      }
    })
  }

  // Grid Listeners
  colorOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color
      updateSelectionUI()
    })
  })
}

function switchSection(sectionName) {
  // Ocultar todas las secciones
  const sections = document.querySelectorAll('.dashboard-section')
  sections.forEach(section => {
    section.classList.remove('active')
    section.style.display = 'none'
  })

  // Mostrar la sección seleccionada
  const targetSection = document.getElementById(`section-${sectionName}`)
  if (targetSection) {
    targetSection.classList.add('active')
    targetSection.style.display = 'block'
  }

  // Actualizar título del header
  updatePageTitle(sectionName)
}

function updatePageTitle(sectionName) {
  const pageTitle = document.getElementById('pageTitle')
  if (!pageTitle) return

  const titles = {
    'dashboard': 'Dashboard',
    'business': 'Mi Negocio',
    'orders': 'Pedidos',
    'categories': 'Categorías',
    'products': 'Productos',
    'promotions': 'Promociones',
    'delivery-persons': 'Gestión de Domiciliarios',
    'whatsapp': 'Mensaje de WhatsApp',
    'support': 'Soporte y Ayuda'
  }

  pageTitle.textContent = titles[sectionName] || 'Dashboard'

  // Mostrar/ocultar botón de editar negocio
  const editBusinessBtn = document.getElementById('editBusinessBtn')
  if (editBusinessBtn) {
    editBusinessBtn.style.display = sectionName === 'business' ? 'flex' : 'none'
  }
}

async function loadBusiness() {
  try {
    currentBusiness = await businessService.getMyBusiness()

    if (!currentBusiness) {
      showNoBusinessState()
    } else {
      // Check if business is operational
      const isOperational = businessService.isOperational(currentBusiness)

      if (!isOperational) {
        // Show Blocked State but load basic data? 
        // Or just block completely?
        // User requested: "solo revisar cosas" -> Read Only. But modal says "Inactivo"
        // Let's load data but show the modal overlay
        await loadAllData()

        // Disable actions?
        const blockedModal = document.getElementById('blockedPlanModal')
        if (blockedModal) blockedModal.style.display = 'flex'

        showBusinessState() // Show dashboard
      } else {
        await loadAllData()
        await loadWhatsAppTemplate()
        showBusinessState()
      }
    }
  } catch (error) {
    console.error('Error loading business:', error)
    showNoBusinessState()
  }
}

async function loadAllData() {
  try {
    // Cargar categorías, productos, métodos de pago y horarios en paralelo
    [categories, products, paymentMethods, businessHours] = await Promise.all([
      categoryService.getByBusiness(currentBusiness.id),
      productService.getByBusiness(currentBusiness.id),
      paymentMethodsService.getByBusiness(currentBusiness.id),
      businessHoursService.getByBusiness(currentBusiness.id)
    ])

    // Load Analytics
    loadAnalyticsData()

    renderBusinessInfo()
    renderCategories()
    renderProducts()
    renderPaymentMethods()
    renderBusinessHours()
    loadSupportTickets() // Cargar tickets soporte
    updateDashboardStats()

    // Check product limit for UI usage bar
    updatePlanUsageUI()

    // Check operational requirements (Alert)
    checkOperationalRequirements()

  } catch (error) {
    console.error('Error loading data:', error)
    notify.error('Error al cargar los datos')
  }
}

async function loadAnalyticsData() {
  if (!currentBusiness) return

  try {
    const startDate = '2024-01-01'
    const endDate = new Date().toISOString().split('T')[0]

    const ordersForAnalytics = await ordersService.getOrdersForExport(currentBusiness.id, {
      startDate: startDate,
      endDate: endDate,
      status: 'all'
    })

    initAnalytics(ordersForAnalytics || [], products || [], categories || [])
  } catch (error) {
    console.error('Error loading analytics data:', error)
  }
}

// ============================================
// EXPORT ORDERS LOGIC
// ============================================
function initOrderExport() {
  const openExportBtn = document.getElementById('openExportModalBtn')
  const exportModal = document.getElementById('exportOrdersModal')
  const closeExportBtn = document.getElementById('closeExportModalBtn')
  const cancelExportBtn = document.getElementById('cancelExportBtn')
  const exportForm = document.getElementById('exportOrdersForm')
  const confirmExportBtn = document.getElementById('confirmExportBtn')

  if (!openExportBtn) return

  // Open Modal
  openExportBtn.addEventListener('click', () => {
    // Set default dates (current month)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)

    // Format to YYYY-MM-DD
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    document.getElementById('exportStartDate').value = formatDate(firstDay)
    document.getElementById('exportEndDate').value = formatDate(now)

    exportModal.style.display = 'flex'
  })

  // Close Modal Actions
  const closeModal = () => {
    exportModal.style.display = 'none'
  }

  if (closeExportBtn) closeExportBtn.addEventListener('click', closeModal)
  if (cancelExportBtn) cancelExportBtn.addEventListener('click', closeModal)

  // Close on outside click
  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) closeModal()
  })

  // Handle Export Submit
  if (exportForm) {
    exportForm.addEventListener('submit', async (e) => {
      e.preventDefault()

      const startDate = document.getElementById('exportStartDate').value
      const endDate = document.getElementById('exportEndDate').value
      const status = document.getElementById('exportStatus').value

      if (!startDate || !endDate) {
        notify.error('Por favor selecciona las fechas')
        return
      }

      if (new Date(startDate) > new Date(endDate)) {
        notify.error('La fecha inicial no puede ser mayor a la fecha final')
        return
      }

      try {
        await buttonLoader.execute(confirmExportBtn, async () => {
          // 1. Fetch Data
          const orders = await ordersService.getOrdersForExport(currentBusiness.id, {
            startDate,
            endDate,
            status
          })

          // 2. Validate existence
          if (!orders || orders.length === 0) {
            notify.info('No se encontraron pedidos en el rango seleccionado')
            return
          }

          // 3. Format Data for Excel
          const exportData = orders.map(order => {
            // Format items list with sides
            const itemsList = order.order_items
              ? order.order_items.map(item => {
                let start = `${item.quantity}x ${item.product_name}`
                // Add sides if any
                if (item.options?.sides?.length > 0) {
                  const sides = item.options.sides.map(s => s.name).join(', ')
                  start += ` (Acomp: ${sides})`
                }
                return start
              }).join('; ')
              : ''

            // Extract just sides for separate column
            const allSides = order.order_items
              ? order.order_items.flatMap(item =>
                item.options?.sides?.map(s => `${item.quantity}x ${s.name}`) || []
              ).join(', ')
              : ''

            return {
              'Fecha': new Date(order.created_at).toLocaleString(),
              'Cliente': order.customer_name,
              'Teléfono': order.customer_phone,
              'Dirección': order.customer_address,
              'Barrio': order.customer_neighborhood || '',
              'Estado': getOrderStatusLabel(order.status),
              'Domiciliario': order.delivery_persons ? `${order.delivery_persons.name} (${order.delivery_persons.unique_code})` : 'No asignado',
              'Total': order.total_amount ? `$${parseFloat(order.total_amount).toLocaleString()}` : '$0',
              'Método Pago': order.payment_method,
              'Productos': itemsList,
              'Acompañantes': allSides,
              'Notas': order.order_notes || ''
            }
          })

          // 4. Generate Excel
          const ws = XLSX.utils.json_to_sheet(exportData)

          // Auto-width columns (simple heuristic)
          const wscols = Object.keys(exportData[0]).map(key => ({ wch: 20 }))
          ws['!cols'] = wscols

          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, "Pedidos")

          // 5. Generate Filename
          const businessNameSafe = (currentBusiness.name || 'negocio')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')

          const filename = `${businessNameSafe}_reporte_de_pedidos.xlsx`

          // 6. Download
          XLSX.writeFile(wb, filename)

          notify.success(`Reporte descargado: ${orders.length} pedidos`)
          closeModal()
        }, 'Generando...')
      } catch (error) {
        console.error('Error exporting orders:', error)
        notify.error('Error al generar el reporte')
      }
    })
  }
}

// Helper to reuse status labels
function getOrderStatusLabel(status) {
  const labels = {
    'pending': 'Pendiente',
    'verified': 'Verificado',
    'completed': 'Completado',
    'cancelled': 'Cancelado'
  }
  return labels[status] || status
}

// ============================================
// SUBSCRIPTION LOGIC
// ============================================
async function updatePlanUsageUI() {
  if (!currentBusiness) return

  const planInfo = businessService.getPlanInfo(currentBusiness)
  const planType = planInfo.type

  // Update Plan UI Elements
  const planBadge = document.getElementById('planBadge')
  const planStatusTag = document.getElementById('planStatusTag')
  const planDaysRemaining = document.getElementById('planDaysRemaining')
  const planExpiryDate = document.getElementById('planExpiryDate')
  const productUsageText = document.getElementById('productUsageText')
  const productUsageBar = document.getElementById('productUsageBar')
  const upgradeMessage = document.getElementById('upgradeMessage')

  if (planBadge) {
    planBadge.textContent = planInfo.label
    planBadge.className = `badge badge-${planType}` // CSS class needed or inline style adjustment
    planBadge.style.background = planType === 'pro' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#3b82f6'
  }

  if (planDaysRemaining) {
    if (planInfo.daysRemaining <= 5 && planInfo.daysRemaining > 0) {
      planDaysRemaining.style.color = '#f59e0b' // Warning
    } else {
      planDaysRemaining.style.color = '#334155'
    }
    planDaysRemaining.textContent = planInfo.daysRemaining > 0 ? `${planInfo.daysRemaining} días` : 'Vencido'
  }

  if (planExpiryDate) {
    planExpiryDate.textContent = `Vence: ${planInfo.expiresAt.toLocaleDateString()}`
  }

  // Usage Meter
  // Usage Meter
  const { allowed, current, limit } = await businessService.canCreateProduct(currentBusiness.id, planType)

  const permanentUpgradeContainer = document.getElementById('permanentUpgradeContainer')

  if (productUsageText && productUsageBar) {
    if (limit === Infinity) {
      // Requested change: "Ilimitados" simply
      productUsageText.textContent = `Ilimitados`
      productUsageBar.style.width = '100%'
      productUsageBar.style.background = 'linear-gradient(135deg, #10b981, #34d399)' // Green for PRO

      // Hide upgrade elements if PRO
      if (upgradeMessage) upgradeMessage.style.display = 'none'
      if (permanentUpgradeContainer) permanentUpgradeContainer.style.display = 'none'

    } else {
      productUsageText.textContent = `${current} / ${limit}`
      const percentage = Math.min((current / limit) * 100, 100)
      productUsageBar.style.width = `${percentage}%`

      // Show warning color if near limit
      if (percentage >= 90) {
        productUsageBar.style.background = '#ef4444' // Red warning
        if (upgradeMessage) upgradeMessage.style.display = 'block'
      } else {
        productUsageBar.style.background = '#3b82f6'
        if (upgradeMessage) upgradeMessage.style.display = 'none'
      }

      // Always show permanent upgrade button for Plus users
      if (permanentUpgradeContainer) permanentUpgradeContainer.style.display = 'block'
    }
  }
}

// Modal Elements & Listeners
const upgradePlanModal = document.getElementById('upgradePlanModal')
const blockedPlanModal = document.getElementById('blockedPlanModal')
const closeUpgradeModal = document.getElementById('closeUpgradeModal')
const contactSupportUpgradeBtn = document.getElementById('contactSupportUpgradeBtn')
const contactSupportRenewBtn = document.getElementById('contactSupportRenewBtn')
const btnUpgradePlan = document.getElementById('btnUpgradePlan')
const btnPermanentUpgrade = document.getElementById('btnPermanentUpgrade') // New button
const logoutBlockedBtn = document.getElementById('logoutBlockedBtn')

// Upgrade Button in Dashboard (Limit Warning)
if (btnUpgradePlan) {
  btnUpgradePlan.addEventListener('click', () => {
    upgradePlanModal.style.display = 'flex'
  })
}

// Permanent Upgrade Button (Always visible for Plus)
if (btnPermanentUpgrade) {
  btnPermanentUpgrade.addEventListener('click', () => {
    upgradePlanModal.style.display = 'flex'
  })
}

if (closeUpgradeModal) {
  closeUpgradeModal.addEventListener('click', () => {
    upgradePlanModal.style.display = 'none'
  })
}

// Contact Actions
const CONTACT_PHONE = '573180779665' // Replace with actual admin number

if (contactSupportUpgradeBtn) {
  contactSupportUpgradeBtn.addEventListener('click', () => {
    const text = `Hola, quiero mejorar mi plan a PRO para el negocio: ${currentBusiness.name}`
    window.open(`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(text)}`, '_blank')
  })
}

if (contactSupportRenewBtn) {
  contactSupportRenewBtn.addEventListener('click', () => {
    const text = `Hola, mi plan ha vencido. Quiero renovar la suscripción para el negocio: ${currentBusiness.name}`
    window.open(`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(text)}`, '_blank')
  })
}

if (logoutBlockedBtn) {
  logoutBlockedBtn.addEventListener('click', async () => {
    await authService.signOut()
    window.location.href = '/login'
  })
}
// ============================================
// DASHBOARD STATS
// ============================================
async function updateDashboardStats() {
  // Total Categorías
  const statTotalCategories = document.getElementById('statTotalCategories')
  if (statTotalCategories) {
    statTotalCategories.textContent = categories.length
  }

  // Total Productos
  const statTotalProducts = document.getElementById('statTotalProducts')
  if (statTotalProducts) {
    statTotalProducts.textContent = products.length
  }

  // Visitas al Catálogo (Global Real)
  const statCatalogVisits = document.getElementById('statCatalogVisits')
  if (statCatalogVisits) {
    try {
      // Since standard SELECT doesn't support .sum() directly like that in client without special setup usually,
      // let's just select views_count and sum in JS for now or use specific aggregate
      // Simpler approach: Select all rows for business and reduce

      // Since standard SELECT doesn't support .sum() directly like that in client without special setup usually,
      // let's just select views_count and sum in JS for now or use specific aggregate
      // Simpler approach: Select all rows for business and reduce

      const { data: stats, error: statsError } = await supabase
        .from('business_stats')
        .select('views_count')
        .eq('business_id', currentBusiness.id)

      if (statsError) throw statsError

      const totalVisits = stats ? stats.reduce((sum, row) => sum + (row.views_count || 0), 0) : 0
      statCatalogVisits.textContent = totalVisits.toLocaleString()

    } catch (err) {
      console.error('Error fetching stats:', err)
      statCatalogVisits.textContent = '-'
    }
  }

  // Top 3 Productos Más Gustados (desde Supabase)
  await updateTop3Products()
}

async function updateTop3Products() {
  const statTop3 = document.getElementById('statTop3Products')
  if (!statTop3) return

  try {
    // Query para obtener productos con conteo de likes
    const { data, error } = await supabase
      .from('product_likes')
      .select(`
        product_id,
        products (
          id,
          name
        )
      `)
      .eq('business_id', currentBusiness.id)

    if (error) throw error

    if (!data || data.length === 0) {
      statTop3.innerHTML = '<p style="color: #9ca3af; font-size: 0.85rem;">Sin datos aún</p>'
      return
    }

    // Agrupar y contar likes por producto
    const likesCount = {}
    data.forEach(like => {
      if (!like.products) return

      const id = like.product_id
      if (!likesCount[id]) {
        likesCount[id] = {
          name: like.products.name,
          count: 0
        }
      }
      likesCount[id].count++
    })

    // Ordenar y tomar top 3
    const top3 = Object.entries(likesCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)

    if (top3.length === 0) {
      statTop3.innerHTML = '<p style="color: #9ca3af; font-size: 0.85rem;">Sin favoritos aún</p>'
      return
    }

    // Renderizar con medallas
    const medals = ['🥇', '🥈', '🥉']
    statTop3.innerHTML = top3.map(([id, data], index) => `
      <div class="top-3-item">
        <span class="top-3-medal">${medals[index]}</span>
        <span class="top-3-name">${data.name}</span>
        <span class="top-3-likes">${data.count} ❤️</span>
      </div>
    `).join('')

  } catch (error) {
    console.error('Error loading top 3:', error)
    statTop3.innerHTML = '<p style="color: #9ca3af; font-size: 0.85rem;">Error al cargar</p>'
  }
}

// ============================================
// ESTADOS DE LA UI
// ============================================
function showNoBusinessState() {
  loadingState.style.display = 'none'
  noBusinessState.style.display = 'flex'
  businessExistsState.style.display = 'none'

  // Disable sidebar navigation
  const sidebarNav = document.querySelector('.sidebar-nav')
  const mobileMenuBtn = document.getElementById('mobileMenuBtn')
  if (sidebarNav) sidebarNav.classList.add('disabled')
  if (mobileMenuBtn) mobileMenuBtn.classList.add('disabled')
}

function showBusinessState() {
  loadingState.style.display = 'none'
  noBusinessState.style.display = 'none'
  businessExistsState.style.display = 'block'

  // Enable sidebar navigation
  const sidebarNav = document.querySelector('.sidebar-nav')
  const mobileMenuBtn = document.getElementById('mobileMenuBtn')
  if (sidebarNav) sidebarNav.classList.remove('disabled')
  if (mobileMenuBtn) mobileMenuBtn.classList.remove('disabled')
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderBusinessInfo() {
  businessName.textContent = currentBusiness.name
  businessWhatsapp.textContent = currentBusiness.whatsapp_number

  // Update description
  const descriptionDisplay = document.getElementById('businessDescription')
  if (descriptionDisplay) {
    descriptionDisplay.textContent = currentBusiness.description || 'Sin descripción'
    if (!currentBusiness.description) {
      descriptionDisplay.style.fontStyle = 'italic'
      descriptionDisplay.style.color = '#9ca3af'
    } else {
      descriptionDisplay.style.fontStyle = 'normal'
      descriptionDisplay.style.color = 'var(--text-primary)'
    }
  }

  // Update address
  const addressDisplay = document.getElementById('businessAddress')
  if (addressDisplay) {
    addressDisplay.textContent = currentBusiness.address || 'No registrada'
  }

  // Update delivery price display
  const deliveryPriceDisplay = document.getElementById('businessDeliveryPrice')
  if (deliveryPriceDisplay) {
    const price = parseFloat(currentBusiness.delivery_price) || 0
    deliveryPriceDisplay.textContent = price > 0
      ? `$${price.toLocaleString('es-CO')}`
      : 'Gratis'
  }

  // Update logo display
  const logoDisplay = document.getElementById('business-logo-display')
  if (logoDisplay) {
    if (currentBusiness.logo_url) {
      logoDisplay.innerHTML = `<img src="${currentBusiness.logo_url}" alt="Logo" style="object-fit:cover; width:100%; height:100%;">`
    } else {
      logoDisplay.innerHTML = `<i class="ri-store-2-line" style="font-size: 3rem; color: #9ca3af;"></i>`
    }
  }

  // Update header background preview
  const headerBgPreview = document.getElementById('header-bg-preview')
  const removeHeaderBgBtn = document.getElementById('removeHeaderBgBtn')
  if (headerBgPreview) {
    if (currentBusiness.header_background_url) {
      headerBgPreview.innerHTML = `<img src="${currentBusiness.header_background_url}" alt="Header Background">`
      headerBgPreview.classList.add('has-image')
      if (removeHeaderBgBtn) removeHeaderBgBtn.style.display = 'inline-flex'
    } else {
      headerBgPreview.innerHTML = `
        <i class="ri-landscape-line"></i>
        <p>Sin imagen de fondo</p>
        <small>Tamaño recomendado: 1200x400px</small>
      `
      headerBgPreview.classList.remove('has-image')
      if (removeHeaderBgBtn) removeHeaderBgBtn.style.display = 'none'
    }
  }

  // Actualizar nombre en el sidebar
  const businessBranchName = document.getElementById('businessBranchName')
  if (businessBranchName) {
    businessBranchName.textContent = currentBusiness.name
  }

  const catalogUrl = `${window.location.origin}/c/${currentBusiness.slug}`
  catalogLink.href = catalogUrl
  catalogLink.textContent = catalogUrl
}

let filteredCategories = []
let filteredProducts = []

function renderCategories(categoriesToRender = null) {
  const catsToShow = categoriesToRender !== null ? categoriesToRender : categories
  filteredCategories = catsToShow

  if (catsToShow.length === 0) {
    categoriesList.innerHTML = '<p class="empty-message">No se encontraron categorías</p>'
    return
  }

  categoriesList.innerHTML = catsToShow.map(category => `
    <div class="category-item" data-id="${category.id}">
      <div class="category-item-info">
        <div class="category-item-name">${category.name}</div>
      </div>
      <div class="category-item-actions">
  <button class="btn-icon edit-category" data-id="${category.id}">
    <i class="ri-edit-line"></i> Editar
  </button>
  <button class="btn-icon danger delete-category" data-id="${category.id}">
    <i class="ri-delete-bin-line"></i> Eliminar
  </button>
</div>
    </div>
  `).join('')

  // Event listeners
  document.querySelectorAll('.edit-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.edit-category').dataset.id
      openEditCategoryModal(id)
    })
  })

  document.querySelectorAll('.delete-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.delete-category').dataset.id
      deleteCategory(id)
    })
  })
}

function renderProducts(productsToRender = null) {
  const prodsToShow = productsToRender !== null ? productsToRender : products
  filteredProducts = prodsToShow

  if (prodsToShow.length === 0) {
    productsList.innerHTML = '<p class="empty-message">No se encontraron productos</p>'
    return
  }

  productsList.innerHTML = prodsToShow.map(product => `
    <div class="product-card" data-id="${product.id}">
      <div class="product-card-image">
        ${product.image_url
      ? `<img src="${product.image_url}" alt="${product.name}">`
      : 'Sin imagen'
    }
      </div>
      <div class="product-card-content">
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-price">$${parseFloat(product.price).toLocaleString()}</div>
        ${product.categories?.name
      ? `<div class="product-card-category">${product.categories.name}</div>`
      : ''
    }
    
    <!-- Status Badge -->
    <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
         ${product.is_active !== false
      ? `<span style="background: #f0fdf4; color: #15803d; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
           <i class="ri-checkbox-circle-line"></i> Activo
         </span>`
      : `<span style="background: #f3f4f6; color: #6b7280; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
           <i class="ri-eye-off-line"></i> Inactivo
         </span>`
    }
    </div>

  <div class="product-card-actions">
    <button class="btn-manage-options manage-options" data-id="${product.id}">
    <i class="ri-settings-3-line"></i><span> Opciones</span>
  </button>
  <button class="btn-icon manage-discount" data-id="${product.id}">
    <i class="ri-price-tag-line"></i><span> Descuentos</span>
 </button>
  <button class="btn-icon edit-product" data-id="${product.id}">
    <i class="ri-edit-line"></i><span> Editar</span>
  </button>
  <button class="btn-icon danger delete-product" data-id="${product.id}">
    <i class="ri-delete-bin-line"></i><span> Eliminar</span>
  </button>
</div>
      </div>
    </div>
  `).join('')

  // Event listeners
  document.querySelectorAll('.edit-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.edit-product').dataset.id
      openEditProductModal(id)
    })
  })

  document.querySelectorAll('.manage-options').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.manage-options').dataset.id
      openProductOptionsModal(id)
    })
  })

  document.querySelectorAll('.delete-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.delete-product').dataset.id
      deleteProduct(id)
    })
  })

  document.querySelectorAll('.manage-discount').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.manage-discount').dataset.id
      openDiscountModal(id)
    })
  })
}

// ============================================
// BUSINESS MODAL
// ============================================

document.getElementById('closeBusinessModal').addEventListener('click', closeBusinessModal)
document.getElementById('cancelBusinessBtn').addEventListener('click', closeBusinessModal)

// Botón de editar negocio en el header
const editBusinessBtn = document.getElementById('editBusinessBtn')
if (editBusinessBtn) {
  editBusinessBtn.addEventListener('click', () => {
    openBusinessModal(true)
  })
}

function openBusinessModal(isEdit = false) {
  const modalTitle = document.getElementById('businessModalTitle')
  const nameInput = document.getElementById('businessNameInput')
  const slugInput = document.getElementById('businessSlugInput')
  const whatsappInput = document.getElementById('businessWhatsappInput')
  const addressInput = document.getElementById('businessAddressInput')
  const deliveryPriceInput = document.getElementById('businessDeliveryPriceInput')
  const descriptionInput = document.getElementById('businessDescriptionInput')

  if (isEdit && currentBusiness) {
    modalTitle.textContent = 'Editar Negocio'
    nameInput.value = currentBusiness.name
    slugInput.value = currentBusiness.slug
    slugInput.disabled = true // No permitir cambiar slug
    whatsappInput.value = currentBusiness.whatsapp_number
    if (addressInput) addressInput.value = currentBusiness.address || ''
    deliveryPriceInput.value = currentBusiness.delivery_price || 0
    descriptionInput.value = currentBusiness.description || ''
  } else {
    modalTitle.textContent = 'Crear Negocio'
    nameInput.value = ''
    slugInput.value = ''
    slugInput.disabled = false
    whatsappInput.value = ''
    if (addressInput) addressInput.value = ''
    deliveryPriceInput.value = 0
    descriptionInput.value = ''
  }

  // Reset validation state
  const saveBtn = document.getElementById('saveBusinessBtn')
  const errorMsg = document.getElementById('whatsappError')
  if (saveBtn) saveBtn.disabled = false
  if (errorMsg) errorMsg.style.display = 'none'

  businessModal.style.display = 'flex'
}

function closeBusinessModal() {
  businessModal.style.display = 'none'
  document.getElementById('businessForm').reset()
}

// Auto-generar slug desde el nombre
document.getElementById('businessNameInput').addEventListener('input', (e) => {
  const slugInput = document.getElementById('businessSlugInput')
  // Solo generar si el campo está habilitado y vacío, o si se está creando
  if (!slugInput.disabled) {
    const generatedSlug = businessService.generateSlug(e.target.value)
    if (generatedSlug) {
      slugInput.value = generatedSlug
    }
  }
})

// WhatsApp Validation Listener
const whatsappInput = document.getElementById('businessWhatsappInput')
if (whatsappInput) {
  whatsappInput.addEventListener('input', (e) => {
    const val = e.target.value
    const clean = val.replace(/\s+/g, '')
    const saveBtn = document.getElementById('saveBusinessBtn')
    const errorMsg = document.getElementById('whatsappError')

    // Regla: Debe empezar por 3 y tener máximo 10 dígitos
    // Permitimos vacío durante la edición, pero HTML required lo bloqueará al enviar
    const startsWith3 = clean.startsWith('3')
    const validLength = clean.length <= 10

    if (clean.length > 0 && (!startsWith3 || !validLength)) {
      if (errorMsg) errorMsg.style.display = 'block'
      if (saveBtn) {
        saveBtn.disabled = true
        saveBtn.style.opacity = '0.5'
        saveBtn.style.cursor = 'not-allowed'
      }
    } else {
      if (errorMsg) errorMsg.style.display = 'none'
      if (saveBtn) {
        saveBtn.disabled = false
        saveBtn.style.opacity = '1'
        saveBtn.style.cursor = 'pointer'
      }
    }
  })
}

document.getElementById('businessForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = document.getElementById('businessNameInput').value
  const slug = document.getElementById('businessSlugInput').value
  let whatsapp = document.getElementById('businessWhatsappInput').value
  const address = document.getElementById('businessAddressInput').value
  const deliveryPrice = parseFloat(document.getElementById('businessDeliveryPriceInput').value) || 0
  const description = document.getElementById('businessDescriptionInput').value

  // Sanitize WhatsApp
  whatsapp = whatsapp.trim().replace(/\s+/g, '')

  if (!whatsapp.startsWith('3') || whatsapp.length > 10) {
    notify.error('Número válido requerido: empieza por 3, máx 10 dígitos')
    return
  }

  const saveBtn = document.getElementById('saveBusinessBtn')

  await buttonLoader.execute(saveBtn, async () => {
    try {
      const businessData = {
        name,
        slug,
        whatsapp_number: whatsapp,
        address: address || null,
        delivery_price: deliveryPrice,
        description
      }

      if (currentBusiness) {
        // Actualizar
        await businessService.updateBusiness(currentBusiness.id, businessData)
        notify.success('Negocio actualizado correctamente')
      } else {
        // Crear
        currentBusiness = await businessService.createBusiness(businessData)
        notify.success('Negocio creado correctamente')
      }

      closeBusinessModal()
      await loadBusiness()
      updateDashboardStats()

    } catch (error) {
      console.error('Error saving business:', error)
      notify.error('Error al guardar el negocio: ' + error.message)
    }
  }, 'Guardando...')
})

// ============================================
// CATEGORY MODAL
// ============================================
addCategoryBtn.addEventListener('click', () => openCategoryModal())

document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal)
document.getElementById('cancelCategoryBtn').addEventListener('click', closeCategoryModal)

function openCategoryModal() {
  editingCategory = null
  document.getElementById('categoryModalTitle').textContent = 'Nueva Categoría'
  document.getElementById('categoryNameInput').value = ''
  categoryModal.style.display = 'flex'
}

function openEditCategoryModal(categoryId) {
  editingCategory = categories.find(c => c.id === categoryId)
  if (!editingCategory) return

  document.getElementById('categoryModalTitle').textContent = 'Editar Categoría'
  document.getElementById('categoryNameInput').value = editingCategory.name
  categoryModal.style.display = 'flex'
}

function closeCategoryModal() {
  categoryModal.style.display = 'none'
  editingCategory = null
  document.getElementById('categoryForm').reset()
}

document.getElementById('categoryForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = document.getElementById('categoryNameInput').value
  const submitBtn = e.submitter || document.querySelector('#categoryForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      if (editingCategory) {
        // Actualizar
        await categoryService.update(editingCategory.id, { name })
        notify.success('Categoría actualizada')
      } else {
        // Crear
        await categoryService.create({
          business_id: currentBusiness.id,
          name,
          display_order: categories.length
        })
        notify.success('Categoría creada')
      }

      closeCategoryModal()
      await loadAllData()
      updateDashboardStats()

    } catch (error) {
      console.error('Error saving category:', error)
      notify.error('Error al guardar la categoría')
    }
  }, 'Guardando...')
})


// ============================================
// SUPPORT FUNCTIONALITY
// ============================================
const supportModal = document.getElementById('supportModal')
const createTicketBtn = document.getElementById('createTicketBtn')
const supportTicketsList = document.getElementById('supportTicketsList')

function initSupport() {
  // Botones para abrir/cerrar modal
  if (createTicketBtn) {
    createTicketBtn.addEventListener('click', openSupportModal)
  }

  const closeBtn = document.getElementById('closeSupportModal')
  const cancelBtn = document.getElementById('cancelSupportBtn')

  if (closeBtn) closeBtn.addEventListener('click', closeSupportModal)
  if (cancelBtn) cancelBtn.addEventListener('click', closeSupportModal)

  // Details Modal
  const closeDetailsBtn = document.getElementById('closeTicketDetailsModal')
  const closeDetailsActionBtn = document.getElementById('closeTicketDetailsBtn')
  if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeTicketDetailsModal)
  if (closeDetailsActionBtn) closeDetailsActionBtn.addEventListener('click', closeTicketDetailsModal)

  // Form submit
  const supportForm = document.getElementById('supportForm')
  if (supportForm) {
    supportForm.addEventListener('submit', handleSupportSubmit)
  }

  // Image Upload logic
  initTicketImageUpload()

  // Search logic
  initSupportSearch()
}

function initSupportSearch() {
  const searchInput = document.getElementById('searchSupportInput')
  const clearBtn = document.getElementById('clearSupportSearch')

  if (!searchInput || !clearBtn) return

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase()

    if (query) {
      clearBtn.style.display = 'flex'
      const filtered = supportTickets.filter(ticket =>
        ticket.title.toLowerCase().includes(query)
      )
      renderSupportTickets(filtered)
    } else {
      clearBtn.style.display = 'none'
      renderSupportTickets(supportTickets)
    }
  })

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    clearBtn.style.display = 'none'
    renderSupportTickets(supportTickets)
    searchInput.focus()
  })
}

function initTicketImageUpload() {
  const ticketImagePreview = document.getElementById('ticketImagePreview')
  const ticketImageInput = document.getElementById('ticketImageInput')
  const ticketImageActions = document.getElementById('ticketImageActions')
  const removeTicketImageBtn = document.getElementById('removeTicketImageBtn')
  const ticketImageProgress = document.getElementById('ticketImageProgress')
  const ticketImageUrlHidden = document.getElementById('ticketImageUrl')

  if (ticketImagePreview) {
    ticketImagePreview.addEventListener('click', () => ticketImageInput.click())
  }

  if (ticketImageInput) {
    ticketImageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return

      // Validations
      if (!file.type.match('image/(jpeg|jpg|png|webp)')) {
        notify.error('Solo se permiten archivos JPG, PNG o WEBP')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        notify.error('El archivo debe pesar menos de 5MB')
        return
      }

      // UI Progress
      if (ticketImageProgress) {
        ticketImageProgress.style.display = 'block'
        const bar = ticketImageProgress.querySelector('.progress-fill')
        if (bar) bar.style.width = '0%'
      }

      try {
        // Resize
        const resizedFile = await imageService.resizeImage(file, 800, 800, 0.9)
        if (ticketImageProgress) {
          const bar = ticketImageProgress.querySelector('.progress-fill')
          if (bar) bar.style.width = '40%'
        }

        // Upload
        const result = await imageService.upload(resizedFile, 'support-tickets')

        if (result.success) {
          if (ticketImageProgress) {
            const bar = ticketImageProgress.querySelector('.progress-fill')
            if (bar) bar.style.width = '100%'
          }

          // Success State
          ticketImageUrlHidden.value = result.url
          ticketImagePreview.innerHTML = `<img src="${result.url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`
          ticketImagePreview.classList.add('has-image')
          ticketImageActions.style.display = 'flex'

          setTimeout(() => {
            if (ticketImageProgress) ticketImageProgress.style.display = 'none'
          }, 500)

        }
      } catch (error) {
        console.error('Error uploading ticket image:', error)
        notify.error('Error al subir la imagen')
        if (ticketImageProgress) ticketImageProgress.style.display = 'none'
      }
    })
  }

  if (removeTicketImageBtn) {
    removeTicketImageBtn.addEventListener('click', () => {
      ticketImageInput.value = ''
      ticketImageUrlHidden.value = ''
      ticketImagePreview.innerHTML = `<i class="ri-image-line"></i><p>Click para subir imagen</p>`
      ticketImagePreview.classList.remove('has-image')
      ticketImageActions.style.display = 'none'
    })
  }
}

function openSupportModal() {
  // Pre-fill data
  if (currentBusiness) {
    document.getElementById('ticketContactPhone').value = currentBusiness.whatsapp_number || ''
  }
  if (currentUser) {
    document.getElementById('ticketContactEmail').value = currentUser.email || ''
  }

  supportModal.style.display = 'flex'
}

function closeSupportModal() {
  supportModal.style.display = 'none'
  document.getElementById('supportForm').reset()

  // Reset image
  const ticketImagePreview = document.getElementById('ticketImagePreview')
  const ticketImageUrlHidden = document.getElementById('ticketImageUrl')

  if (ticketImagePreview) {
    ticketImagePreview.innerHTML = `<i class="ri-image-line"></i><p>Click para subir imagen</p>`
    ticketImagePreview.classList.remove('has-image')
  }
  if (ticketImageUrlHidden) ticketImageUrlHidden.value = ''

  const ticketImageActions = document.getElementById('ticketImageActions')
  if (ticketImageActions) ticketImageActions.style.display = 'none'
}

async function handleSupportSubmit(e) {
  e.preventDefault()

  // Get values
  const title = document.getElementById('ticketTitle').value
  const description = document.getElementById('ticketDescription').value
  const contact_name = document.getElementById('ticketContactName').value
  // Phone/Email are readonly but we can get them
  const contact_phone = document.getElementById('ticketContactPhone').value
  const contact_email = document.getElementById('ticketContactEmail').value
  const image_url = document.getElementById('ticketImageUrl').value

  const btn = document.getElementById('submitTicketBtn')

  await buttonLoader.execute(btn, async () => {
    try {
      const ticketData = {
        business_id: currentBusiness.id,
        user_id: currentUser.id,
        title,
        description,
        contact_name,
        contact_phone,
        contact_email,
        image_url: image_url || null
      }

      await supportService.create(ticketData)

      notify.success('Solicitud enviada correctamente')
      closeSupportModal()
      await loadSupportTickets() // Refresh list

    } catch (error) {
      console.error('Error creating ticket:', error)
      notify.error('Error al enviar la solicitud')
    }

  }, 'Enviando...')
}

async function loadSupportTickets() {
  if (!currentBusiness) return

  try {
    const tickets = await supportService.getByBusiness(currentBusiness.id)
    supportTickets = tickets // Save to global state
    renderSupportTickets(tickets)
  } catch (error) {
    console.error('Error loading tickets:', error)
    notify.error('Error al cargar historial de soporte')
  }
}

function renderSupportTickets(tickets) {
  if (!tickets || tickets.length === 0) {
    supportTicketsList.innerHTML = ''
    document.getElementById('noTicketsMessage').style.display = 'block'
    return
  }

  document.getElementById('noTicketsMessage').style.display = 'none'

  supportTicketsList.innerHTML = tickets.map(ticket => `
    <tr class="ticket-row" data-id="${ticket.id}" style="cursor: pointer; transition: background 0.2s;">
        <td style="font-family:monospace; font-weight:600; color:var(--color-primary);">${ticket.ticket_code || '...'}</td>
        <td>
           <div style="font-weight:500;">${ticket.title}</div>
        </td>
        <td style="color:var(--text-muted); font-size:0.85rem;">
          ${new Date(ticket.created_at).toLocaleDateString()}
        </td>
        <td>
           <span class="status-badge ${getStatusClass(ticket.status)}">
             ${getStatusLabel(ticket.status)}
           </span>
        </td>
        <td>
           <button class="btn-icon danger delete-ticket" data-id="${ticket.id}" title="Eliminar solicitud">
             <i class="ri-delete-bin-line"></i>
           </button>
        </td>
    </tr>
  `).join('')

  // Add click listeners to rows
  document.querySelectorAll('.ticket-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Prevent opening modal if clicking delete button
      if (e.target.closest('.delete-ticket')) return

      const id = row.dataset.id
      const ticket = tickets.find(t => t.id === id)
      if (ticket) {
        openTicketDetailsModal(ticket)
      }
    })
  })

  // Add click listeners for delete buttons
  document.querySelectorAll('.delete-ticket').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation() // Prevent row click
      const id = btn.dataset.id || btn.closest('.delete-ticket').dataset.id
      deleteTicket(id)
    })
  })
}

// Modal Details Logic
function openTicketDetailsModal(ticket) {
  document.getElementById('detailTicketCode').textContent = ticket.ticket_code || 'N/A'
  document.getElementById('detailTicketStatus').textContent = getStatusLabel(ticket.status)
  document.getElementById('detailTicketStatus').className = `status-badge ${getStatusClass(ticket.status)}`

  document.getElementById('detailTicketTitle').textContent = ticket.title
  document.getElementById('detailTicketDate').textContent = new Date(ticket.created_at).toLocaleString()
  document.getElementById('detailTicketDescription').textContent = ticket.description

  // Image
  const imgContainer = document.getElementById('detailTicketImageContainer')
  const img = document.getElementById('detailTicketImage')

  if (ticket.image_url) {
    img.src = ticket.image_url
    img.onclick = () => window.open(ticket.image_url, '_blank')
    img.style.cursor = 'pointer'
    imgContainer.style.display = 'block'
  } else {
    imgContainer.style.display = 'none'
  }

  // Response
  const responseContainer = document.getElementById('detailTicketResponseContainer')
  const responseText = document.getElementById('detailTicketResponse')

  if (ticket.support_response) {
    responseText.textContent = ticket.support_response
    responseContainer.style.display = 'block'
  } else {
    responseContainer.style.display = 'none'
  }

  document.getElementById('ticketDetailsModal').style.display = 'flex'
}

function closeTicketDetailsModal() {
  document.getElementById('ticketDetailsModal').style.display = 'none'
}

function getStatusClass(status) {
  switch (status) {
    case 'pending': return 'pending'
    case 'in_progress': return 'pending' // Re-use pending style or add new one
    case 'resolved': return 'resolved'
    case 'closed': return 'resolved' // Re-use resolved style
    default: return 'pending'
  }
}

function getStatusLabel(status) {
  const labels = {
    'pending': 'Pendiente',
    'in_progress': 'En Proceso',
    'resolved': 'Resuelto',
    'closed': 'Cerrado'
  }
  return labels[status] || status
}

async function deleteTicket(id) {
  const confirmed = await confirm.show({
    title: '¿Eliminar solicitud?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!confirmed) return

  try {
    await supportService.delete(id)
    notify.success('Solicitud eliminada')
    await loadSupportTickets()
  } catch (error) {
    console.error('Error deleting ticket:', error)
    notify.error('Error al eliminar la solicitud')
  }
}



async function deleteCategory(categoryId) {
  const result = await confirm.show({
    title: '¿Eliminar categoría?',
    message: 'Los productos asociados mantendrán su información.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando categoría...')

  try {
    await categoryService.delete(categoryId)
    notify.updateLoading(loadingToast, 'Categoría eliminada', 'success')
    await loadAllData()
  } catch (error) {
    console.error('Error deleting category:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar la categoría', 'error')
  }
}

// ============================================
// PRODUCT MODAL
// ============================================
addProductBtn.addEventListener('click', async () => {
  // Check limits before opening
  if (!currentBusiness) return

  const planInfo = businessService.getPlanInfo(currentBusiness)

  // Use button loader to prevent double clicks and show feedback
  await buttonLoader.execute(addProductBtn, async () => {
    const { allowed } = await businessService.canCreateProduct(currentBusiness.id, planInfo.type)

    if (!allowed && planInfo.type !== 'pro') {
      // Show Upgrade Modal
      const upgradeModal = document.getElementById('upgradePlanModal')
      if (upgradeModal) upgradeModal.style.display = 'flex'
    } else {
      openProductModal()
    }
  })
})

document.getElementById('closeProductModal').addEventListener('click', closeProductModal)
document.getElementById('cancelProductBtn').addEventListener('click', closeProductModal)

function openProductModal() {
  editingProduct = null
  document.getElementById('productModalTitle').textContent = 'Nuevo Producto'
  document.getElementById('productForm').reset()

  // Default Active
  const activeInput = document.getElementById('productActiveInput')
  const activeLabel = document.getElementById('productActiveLabel')

  if (activeInput) {
    activeInput.checked = true
    if (activeLabel) activeLabel.textContent = 'Activo'

    // Dynamic Label Listener
    activeInput.onchange = () => {
      if (activeLabel) activeLabel.textContent = activeInput.checked ? 'Activo' : 'Inactivo'
    }
  }

  populateCategorySelect()
  resetProductImageUpload()
  productModal.style.display = 'flex'
}

function openEditProductModal(productId) {
  editingProduct = products.find(p => p.id === productId)
  if (!editingProduct) return

  document.getElementById('productModalTitle').textContent = 'Editar Producto'
  document.getElementById('productNameInput').value = editingProduct.name
  document.getElementById('productPriceInput').value = editingProduct.price
  document.getElementById('productDescriptionInput').value = editingProduct.description || ''

  populateCategorySelect()
  document.getElementById('productCategoryInput').value = editingProduct.category_id || ''

  // Is Active Toggle
  const activeInput = document.getElementById('productActiveInput')
  const activeLabel = document.getElementById('productActiveLabel')
  if (activeInput) {
    const isActive = editingProduct.is_active !== false
    activeInput.checked = isActive
    if (activeLabel) activeLabel.textContent = isActive ? 'Activo' : 'Inactivo'

    // Dynamic Label Listener
    activeInput.onchange = () => {
      if (activeLabel) activeLabel.textContent = activeInput.checked ? 'Activo' : 'Inactivo'
    }
  }

  // Cargar imagen si existe
  if (editingProduct.image_url) {
    currentProductImage = editingProduct.image_url
    productImageUrlHidden.value = editingProduct.image_url
    productImagePreview.innerHTML = `<img src="${editingProduct.image_url}" alt="Preview">`
    productImagePreview.classList.add('has-image')
    imageUploadActions.style.display = 'flex'
  } else {
    resetProductImageUpload()
  }

  productModal.style.display = 'flex'
}

function closeProductModal() {
  productModal.style.display = 'none'
  editingProduct = null
  document.getElementById('productForm').reset()
  resetProductImageUpload() // ← AGREGAR ESTA LÍNEA
}

function populateCategorySelect() {
  const select = document.getElementById('productCategoryInput')
  select.innerHTML = '<option value="">Sin categoría</option>'

  categories.forEach(cat => {
    const option = document.createElement('option')
    option.value = cat.id
    option.textContent = cat.name
    select.appendChild(option)
  })
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = document.getElementById('productNameInput').value
  const price = document.getElementById('productPriceInput').value
  const categoryId = document.getElementById('productCategoryInput').value || null
  const description = document.getElementById('productDescriptionInput').value
  const imageUrl = productImageUrlHidden.value || currentProductImage || ''

  // Get Active Status
  const activeInput = document.getElementById('productActiveInput')
  const isActive = activeInput ? activeInput.checked : true

  const saveBtn = document.getElementById('saveProductBtn')

  await buttonLoader.execute(saveBtn, async () => {
    try {
      const productData = {
        business_id: currentBusiness.id,
        name,
        price: parseFloat(price),
        category_id: categoryId,
        description,
        image_url: imageUrl,
        is_active: isActive,
        display_order: products.length
      }

      if (editingProduct) {
        // Actualizar
        await productService.update(editingProduct.id, productData)
        notify.success('Producto actualizado')
      } else {
        // Crear
        await productService.create(productData)
        notify.success('Producto creado')
      }

      closeProductModal()
      await loadAllData()
      updateDashboardStats()

    } catch (error) {
      console.error('Error saving product:', error)
      notify.error('Error al guardar el producto')
    }
  }, 'Guardando...')
})

async function deleteProduct(productId) {
  const result = await confirm.show({
    title: '¿Eliminar producto?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando producto...')

  try {
    await productService.delete(productId)
    notify.updateLoading(loadingToast, 'Producto eliminado', 'success')
    await loadAllData()
  } catch (error) {
    console.error('Error deleting product:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar el producto', 'error')
  }
}

// ============================================
// OTROS EVENTOS
// ============================================
logoutBtn.addEventListener('click', async () => {
  const result = await confirm.show({
    title: '¿Cerrar sesión?',
    message: 'Tendrás que iniciar sesión de nuevo.',
    confirmText: 'Cerrar sesión',
    cancelText: 'Cancelar',
    type: 'info'
  })

  if (!result) return

  // Clean up session storage
  sessionStorage.clear()

  await authService.signOut()
  window.location.href = '/login'
})

// ============================================
// PRODUCT OPTIONS MANAGEMENT
// ============================================

// ============================================
// PRODUCT OPTIONS MANAGEMENT
// ============================================

let currentProductForOptions = null
let productOptionGroups = []
let ungroupedOptions = []
let editingGroup = null
let editingOption = null
let editingOptionType = null // 'quick_comment' or 'side' (internal logic)

const productOptionsModal = document.getElementById('productOptionsModal')
const closeProductOptionsModal = document.getElementById('closeProductOptionsModal')
const closeProductOptionsBtn = document.getElementById('closeProductOptionsBtn')
const optionsProductName = document.getElementById('optionsProductName')

// NEW: Containers for Groups
const quickCommentsListDashboard = document.getElementById('quickCommentsListDashboard')
const sidesListDashboard = document.getElementById('sidesListDashboard') // We might keep using this for sides or similar

// Buttons
const addQuickCommentBtn = document.getElementById('addQuickCommentBtn') // Will be "Agregar Grupo"
const addSideBtn = document.getElementById('addSideBtn')

// Option Modal
const optionModal = document.getElementById('optionModal')
const closeOptionModal = document.getElementById('closeOptionModal')
const cancelOptionBtn = document.getElementById('cancelOptionBtn')
const optionForm = document.getElementById('optionForm')
const optionModalTitle = document.getElementById('optionModalTitle')
const optionNameInput = document.getElementById('optionNameInput')
const optionPriceInput = document.getElementById('optionPriceInput')
const optionPriceGroup = document.getElementById('optionPriceGroup')

// GROUP MODAL ELEMENTS (To be created dynamically or used if exists)
// We will reuse optionModal structure but inject new fields or create a new modal on the fly?
// Better to create the HTML structure in JS for the Group Modal since it doesn't exist in HTML
let groupModal = null

// Función para abrir modal de opciones
async function openProductOptionsModal(productId) {
  currentProductForOptions = products.find(p => p.id === productId)
  if (!currentProductForOptions) return

  currentPromotionForOptions = null

  // Resetear estado
  productOptionGroups = []
  ungroupedOptions = []

  optionsProductName.textContent = currentProductForOptions.name

  // Update Button Text
  // Replace the button to remove old listeners
  const oldBtn = document.getElementById('addQuickCommentBtn')
  const newBtn = oldBtn.cloneNode(true)
  oldBtn.parentNode.replaceChild(newBtn, oldBtn)

  // Update Button Text and Click Handler
  newBtn.textContent = 'Nuevo Grupo'
  newBtn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Opening Group Modal...')
    openGroupModal()
  }

  // Restore Side button
  const oldSideBtn = document.getElementById('addSideBtn')
  const newSideBtn = oldSideBtn.cloneNode(true)
  oldSideBtn.parentNode.replaceChild(newSideBtn, oldSideBtn)

  newSideBtn.style.display = 'block'
  newSideBtn.textContent = 'Agregar Acompañante'
  newSideBtn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    openOptionModal('side')
  }

  await loadProductOptions(productId)
  renderProductOptionsDashboard()

  // Load and render product sizes
  await loadProductSizes(productId)
  renderProductSizesDashboard()

  productOptionsModal.style.display = 'flex'
}

let productSides = [] // New array for sides

async function loadProductOptions(productId) {
  try {
    const data = await productOptionsService.getGroupsByProduct(productId)
    productOptionGroups = data

    // Fetch all options to separate Sides and Ungrouped Comments
    const allOptions = await productOptionsService.getByProduct(productId)

    // Filter Sides: Assuming type is 'side'
    productSides = allOptions.filter(opt => opt.type === 'side')

    // Filter Ungrouped Comments: type is 'quick_comment' (or null) AND group_id is null
    ungroupedOptions = allOptions.filter(opt => (opt.type === 'quick_comment' || !opt.type) && !opt.group_id)

  } catch (error) {
    console.error('Error loading product options:', error)
    productOptionGroups = []
    ungroupedOptions = []
    productSides = []
  }
}

function renderProductOptionsDashboard() {
  quickCommentsListDashboard.innerHTML = ''

  // Clean sides list if it exists (it should, based on HTML view)
  if (sidesListDashboard) sidesListDashboard.innerHTML = ''

  // ============================
  // RENDER GROUPS
  // ============================
  if (productOptionGroups.length > 0) {
    productOptionGroups.forEach(group => {
      const groupEl = document.createElement('div')
      groupEl.className = 'option-group-item'
      groupEl.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; padding: 1rem; background: #f9fafb;'

      const typeLabel = group.type === 'radio' ? 'Selección Única (Radio)' : 'Selección Múltiple (Checkbox)'
      const limitsLabel = group.type === 'checkbox' && group.max_selections > 0
        ? `(Máx. ${group.max_selections})`
        : ''

      groupEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
          <div>
            <h4 style="margin: 0; font-weight: 600; color: #374151;">${group.name}</h4>
            <span style="font-size: 0.75rem; color: #6b7280;">${typeLabel} ${limitsLabel}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-icon-small edit-group" data-id="${group.id}">Editar</button>
            <button class="btn-icon-small danger delete-group" data-id="${group.id}">Eliminar</button>
            <button class="btn-icon-small primary add-option-to-group" data-group-id="${group.id}" style="margin-left: 0.5rem;">+ Opción</button>
          </div>
        </div>
        <div class="group-options-list">
          ${group.options && group.options.length > 0 ? '' : '<p style="color: #9ca3af; font-size: 0.85rem; font-style: italic;">Sin opciones</p>'}
        </div>
      `

      // Render Options inside Group
      const optionsContainer = groupEl.querySelector('.group-options-list')
      if (group.options && group.options.length > 0) {
        group.options.forEach(opt => {
          const optEl = document.createElement('div')
          optEl.className = 'option-item'
          optEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border: 1px solid #eee; border-radius: 6px; margin-bottom: 0.25rem;'
          optEl.innerHTML = `
            <div class="option-item-info">
              <span class="option-item-name" style="font-weight: 500;">${opt.name}</span>
              ${parseFloat(opt.price) > 0 ? `<span class="option-item-price" style="margin-left: 0.5rem; color: #059669; font-size: 0.85rem;">+$${parseFloat(opt.price).toLocaleString()}</span>` : ''}
            </div>
            <div class="option-item-actions">
              <button class="btn-icon-small edit-option" data-id="${opt.id}" data-group-id="${group.id}">Editar</button>
              <button class="btn-icon-small danger delete-option" data-id="${opt.id}">Eliminar</button>
            </div>
          `
          optionsContainer.appendChild(optEl)
        })
      }

      quickCommentsListDashboard.appendChild(groupEl)
    })
  }

  // ============================
  // RENDER UNGROUPED (Legacy)
  // ============================
  if (ungroupedOptions.length > 0) {
    const ungroupedEl = document.createElement('div')
    ungroupedEl.className = 'option-group-item'
    ungroupedEl.style.cssText = 'border: 1px dashed #9ca3af; border-radius: 8px; margin-bottom: 1rem; padding: 1rem; background: #fff;'

    ungroupedEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
        <div>
          <h4 style="margin: 0; font-weight: 600; color: #6b7280;">Opciones Generales (Sin Grupo)</h4>
        </div>
      </div>
      <div class="group-options-list"></div>
    `
    const optionsContainer = ungroupedEl.querySelector('.group-options-list')
    ungroupedOptions.forEach(opt => {
      const optEl = document.createElement('div')
      optEl.className = 'option-item'
      optEl.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f9fafb; border: 1px solid #eee; border-radius: 6px; margin-bottom: 0.25rem;'
      optEl.innerHTML = `
        <div class="option-item-info">
          <span class="option-item-name" style="font-weight: 500;">${opt.name}</span>
          ${parseFloat(opt.price) > 0 ? `<span class="option-item-price" style="margin-left: 0.5rem; color: #059669; font-size: 0.85rem;">+$${parseFloat(opt.price).toLocaleString()}</span>` : ''}
        </div>
        <div class="option-item-actions">
          <button class="btn-icon-small edit-option" data-id="${opt.id}" data-group-id="">Editar</button>
          <button class="btn-icon-small danger delete-option" data-id="${opt.id}">Eliminar</button>
        </div>
      `
      optionsContainer.appendChild(optEl)
    })

    quickCommentsListDashboard.appendChild(ungroupedEl)
  }

  if (productOptionGroups.length === 0 && ungroupedOptions.length === 0) {
    quickCommentsListDashboard.innerHTML = '<p class="empty-message" style="padding: 2rem; text-align: center; color: #9ca3af;">No hay grupos de opciones configurados. <br>Crea un grupo para empezar.</p>'
  }

  // ============================
  // RENDER SIDES (Acompañantes)
  // ============================
  if (sidesListDashboard) {
    if (productSides.length > 0) {
      // Check if we need a container or just list items
      // Using simpler styling for sides
      const sidesContainer = document.createElement('div')
      sidesContainer.className = 'sides-container'
      // Header for Sides REMOVED to avoid duplication
      // sidesContainer.innerHTML = '<h4>Acompañantes</h4>' 

      productSides.forEach(opt => {
        const optEl = document.createElement('div')
        optEl.className = 'option-item side-item'
        // styles moved to CSS .side-item
        optEl.innerHTML = `
            <div class="option-item-info">
              <span class="option-item-name" style="font-weight: 500;">${opt.name}</span>
              ${parseFloat(opt.price) > 0 ? `<span class="option-item-price" style="margin-left: 0.5rem; color: #d97706; font-size: 0.85rem;">+$${parseFloat(opt.price).toLocaleString()}</span>` : ''}
            </div>
            <div class="option-item-actions">
              <button class="btn-icon-small edit-option-side" data-id="${opt.id}">Editar</button>
              <button class="btn-icon-small danger delete-option-side" data-id="${opt.id}">Eliminar</button>
            </div>
          `
        sidesContainer.appendChild(optEl)
      })

      sidesListDashboard.appendChild(sidesContainer)
      sidesListDashboard.style.display = 'block'
    } else {
      sidesListDashboard.innerHTML = '<p style="color: #9ca3af; font-size: 0.85rem; padding: 1rem; text-align: center;">Sin acompañantes</p>'
      sidesListDashboard.style.display = 'block'
    }
  }

  attachOptionEventListeners()
}

function attachOptionEventListeners() {
  // Group Listeners
  document.querySelectorAll('.edit-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      openGroupModal(id)
    })
  })

  document.querySelectorAll('.delete-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      deleteGroup(id)
    })
  })

  document.querySelectorAll('.add-option-to-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const groupId = e.target.dataset.groupId
      openOptionModal('quick_comment', null, groupId)
    })
  })

  // Option Listeners (Groups & Ungrouped)
  document.querySelectorAll('.edit-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      openOptionModal('quick_comment', id)
    })
  })

  document.querySelectorAll('.delete-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      deleteOption(id)
    })
  })

  // Side Listeners
  document.querySelectorAll('.edit-option-side').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      openOptionModal('side', id)
    })
  })

  document.querySelectorAll('.delete-option-side').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      deleteOption(id)
    })
  })
}

// Cerrar modal de opciones
closeProductOptionsModal.addEventListener('click', () => {
  productOptionsModal.style.display = 'none'
  currentProductForOptions = null
  addSideBtn.style.display = 'block' // Restore
})

closeProductOptionsBtn.addEventListener('click', () => {
  productOptionsModal.style.display = 'none'
  currentProductForOptions = null
  addSideBtn.style.display = 'block' // Restore
})

// ============================================
// GROUP MODAL MANAGEMENT
// ============================================
function createGroupModalHTML() {
  if (document.getElementById('groupModal')) return

  const modal = document.createElement('div')
  modal.id = 'groupModal'
  modal.className = 'modal' // Changed from modal-overlay to match other modals
  modal.style.display = 'none'
  modal.style.zIndex = '9999' // Ensure it is on top of productOptionsModal
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="groupModalTitle">Nuevo Grupo</h3>
        <button class="btn-icon" id="closeGroupModal"><i class="ri-close-line"></i></button>
      </div>
      <form id="groupForm" class="modal-form">
        <div class="form-group">
          <label>Nombre del Grupo</label>
          <input type="text" id="groupNameInput" class="form-input" placeholder="Ej: Salsas, Término, Adiciones" required>
        </div>
        <div class="form-group">
          <label>Tipo de Selección</label>
          <select id="groupTypeInput" class="form-select">
            <option value="checkbox">Selección Múltiple</option>
            <option value="radio">Selección Única</option>
          </select>
        </div>
        <div class="form-grid" id="groupLimitsContainer">
          <div class="form-group">
            <label>Mínimo (0 = Opcional)</label>
            <input type="number" id="groupMinInput" class="form-input" value="0" min="0">
          </div>
          <div class="form-group">
            <label>Máximo (0 = Ilimitado)</label>
            <input type="number" id="groupMaxInput" class="form-input" value="0" min="0">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="cancelGroupBtn">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(modal)

  // Listeners
  document.getElementById('closeGroupModal').addEventListener('click', closeGroupModalFn)
  document.getElementById('cancelGroupBtn').addEventListener('click', closeGroupModalFn)
  document.getElementById('groupForm').addEventListener('submit', handleGroupSubmit)

  // Toggle limits visibility based on type
  document.getElementById('groupTypeInput').addEventListener('change', (e) => {
    const container = document.getElementById('groupLimitsContainer')
    if (e.target.value === 'radio') {
      container.style.opacity = '0.5'
      document.getElementById('groupMinInput').disabled = true
      document.getElementById('groupMaxInput').disabled = true
    } else {
      container.style.opacity = '1'
      document.getElementById('groupMinInput').disabled = false
      document.getElementById('groupMaxInput').disabled = false
    }
  })
}

function openGroupModal(groupId = null) {
  try {
    console.log('openGroupModal called with groupId:', groupId)
    createGroupModalHTML()

    const modal = document.getElementById('groupModal')
    const title = document.getElementById('groupModalTitle')
    const nameInput = document.getElementById('groupNameInput')
    const typeInput = document.getElementById('groupTypeInput')
    const minInput = document.getElementById('groupMinInput')
    const maxInput = document.getElementById('groupMaxInput')

    if (!modal) {
      console.error('Modal element not found!')
      return
    }

    if (groupId) {
      editingGroup = productOptionGroups.find(g => g.id === groupId)
      title.textContent = 'Editar Grupo'
      nameInput.value = editingGroup.name
      typeInput.value = editingGroup.type
      minInput.value = editingGroup.min_selections
      maxInput.value = editingGroup.max_selections

      // Trigger change to update UI state
      typeInput.dispatchEvent(new Event('change'))
    } else {
      editingGroup = null
      title.textContent = 'Nuevo Grupo'
      nameInput.value = ''
      typeInput.value = 'checkbox'
      minInput.value = 0
      maxInput.value = 0
      typeInput.dispatchEvent(new Event('change'))
    }

    modal.style.display = 'flex'
  } catch (error) {
    console.error('Error opening group modal:', error)
    notify.error('Error al abrir el modal de grupo')
  }
}

function closeGroupModalFn() {
  document.getElementById('groupModal').style.display = 'none'
  document.getElementById('groupForm').reset()
  editingGroup = null
}

async function handleGroupSubmit(e) {
  e.preventDefault()

  const name = document.getElementById('groupNameInput').value
  const type = document.getElementById('groupTypeInput').value
  const min = parseInt(document.getElementById('groupMinInput').value) || 0
  const max = parseInt(document.getElementById('groupMaxInput').value) || 0

  const submitBtn = e.submitter || document.querySelector('#groupForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      const groupData = {
        product_id: currentProductForOptions.id,
        name,
        type,
        min_selections: min,
        max_selections: max
      }

      if (editingGroup) {
        await productOptionsService.updateGroup(editingGroup.id, groupData)
        notify.success('Grupo actualizado')
      } else {
        groupData.display_order = productOptionGroups.length
        await productOptionsService.createGroup(groupData)
        notify.success('Grupo creado')
      }

      closeGroupModalFn()
      await loadProductOptions(currentProductForOptions.id)
      renderProductOptionsDashboard()

    } catch (error) {
      console.error('Error saving group:', error)
      notify.error('Error al guardar grupo')
    }
  }, 'Guardando...')
}

async function deleteGroup(groupId) {
  const result = await confirm.show({
    title: '¿Eliminar grupo?',
    message: 'Se eliminarán todas las opciones dentro de este grupo.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  try {
    await productOptionsService.deleteGroup(groupId)
    notify.success('Grupo eliminado')
    await loadProductOptions(currentProductForOptions.id)
    renderProductOptionsDashboard()
  } catch (error) {
    console.error('Error deleting group:', error)
    notify.error('Error al eliminar grupo')
  }
}

// ============================================
// OPTION MODAL ADAPTATION
// ============================================

let currentGroupIdForOption = null

function openOptionModal(type, optionId = null, groupId = null) {
  editingOptionType = type // Keep for compatibility
  currentGroupIdForOption = groupId

  if (optionId) {
    // Editar
    // Search in groups or ungrouped
    let found = ungroupedOptions.find(opt => opt.id === optionId)
    if (!found) {
      for (const g of productOptionGroups) {
        found = g.options.find(opt => opt.id === optionId)
        if (found) {
          currentGroupIdForOption = g.id
          break
        }
      }
    }
    editingOption = found

    optionModalTitle.textContent = 'Editar Opción'
    optionNameInput.value = editingOption.name
    optionPriceInput.value = editingOption.price || 0
  } else {
    // Crear
    editingOption = null
    optionModalTitle.textContent = 'Nueva Opción'
    optionNameInput.value = ''
    optionPriceInput.value = 0
  }

  // Siempre mostrar precio (ahora todas pueden tener precio)
  optionPriceGroup.style.display = 'flex'

  optionModal.style.display = 'flex'
}

// Update existing optionForm submit listener?? 
// We need to modify the existing one to include group_id
// Since we are replacing the block containing the event listener, we can rewrite it.

function openEditOptionModal(optionId, type) {
  openOptionModal(type, optionId)
}

function closeOptionModalFn() {
  optionModal.style.display = 'none'
  editingOption = null
  editingOptionType = null
  currentGroupIdForOption = null
  optionForm.reset()
}

closeOptionModal.addEventListener('click', closeOptionModalFn)
cancelOptionBtn.addEventListener('click', closeOptionModalFn)

// Guardar opción
optionForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = optionNameInput.value
  const price = parseFloat(optionPriceInput.value) || 0
  const submitBtn = e.submitter || document.querySelector('#optionForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      // Check if we're working with promotions or products
      if (currentPromotionForOptions) {
        // PROMOTION OPTIONS (Legacy/Parallel logic?)
        const optionData = {
          promotion_id: currentPromotionForOptions.id,
          type: editingPromotionOptionType,
          name,
          price,
          display_order: editingPromotionOption ? editingPromotionOption.display_order : 0
        }

        if (editingPromotionOption) {
          await promotionOptionsService.update(editingPromotionOption.id, optionData)
          notify.success('Opción actualizada')
        } else {
          await promotionOptionsService.create(optionData)
          notify.success('Opción creada')
        }

        closeOptionModalFn()
        await loadPromotionOptions(currentPromotionForOptions.id)
        renderPromotionOptionsDashboard()

      } else if (currentProductForOptions) {
        // PRODUCT OPTIONS (Groups & Sides)

        // Determine type: use editingOptionType if set (e.g. 'side'), otherwise default to 'quick_comment'
        const typeToSave = editingOptionType || 'quick_comment'

        const optionData = {
          product_id: currentProductForOptions.id,
          type: typeToSave,
          name,
          price,
          // Group ID is only for quick_comments belonging to a group
          group_id: (typeToSave === 'side') ? null : (currentGroupIdForOption || null),
          display_order: editingOption ? editingOption.display_order : 0
        }

        console.log('Saving option with data:', optionData)

        if (editingOption) {
          await productOptionsService.update(editingOption.id, optionData)
          notify.success('Opción actualizada')
        } else {
          // Calculate new display order if possible, otherwise DB handles it or it's 0
          // Ideally we fetch max order, but for now 0 or append
          // If we have local list, we can use it.
          // For now, let's just save.
          await productOptionsService.create(optionData)
          notify.success('Opción creada')
        }

        closeOptionModalFn()
        await loadProductOptions(currentProductForOptions.id)
        renderProductOptionsDashboard()
      }

    } catch (error) {
      console.error('Error saving option:', error)
      notify.error('Error al guardar la opción')
    }
  }, 'Guardando...')
})

// Eliminar opción
async function deleteOption(optionId) {
  const result = await confirm.show({
    title: '¿Eliminar opción?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando opción...')

  try {
    await productOptionsService.delete(optionId)
    notify.updateLoading(loadingToast, 'Opción eliminada', 'success')
    await loadProductOptions(currentProductForOptions.id)
    renderProductOptionsDashboard()
  } catch (error) {
    console.error('Error deleting option:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar la opción', 'error')
  }
}


// ============================================
// PRODUCT SIZES MANAGEMENT
// ============================================
let currentProductSizes = []
let editingSizeId = null

const sizeModal = document.getElementById('sizeModal')
const closeSizeModal = document.getElementById('closeSizeModal')
const cancelSizeBtn = document.getElementById('cancelSizeBtn')
const sizeForm = document.getElementById('sizeForm')
const sizeNameInput = document.getElementById('sizeNameInput')
const sizePriceInput = document.getElementById('sizePriceInput')
const sizesListDashboard = document.getElementById('sizesListDashboard')
const addSizeBtn = document.getElementById('addSizeBtn')

// Initialize sizes listeners
if (addSizeBtn) addSizeBtn.addEventListener('click', () => openSizeModal())
if (closeSizeModal) closeSizeModal.addEventListener('click', closeSizeModalFunc)
if (cancelSizeBtn) cancelSizeBtn.addEventListener('click', closeSizeModalFunc)
if (sizeForm) sizeForm.addEventListener('submit', handleSizeFormSubmit)

/**
 * Load product sizes from database
 */
async function loadProductSizes(productId) {
  try {
    currentProductSizes = await productSizesService.getByProduct(productId)
  } catch (error) {
    console.error('Error loading product sizes:', error)
    currentProductSizes = []
  }
}

/**
 * Render product sizes list in dashboard
 */
function renderProductSizesDashboard() {
  if (!sizesListDashboard) return

  if (currentProductSizes.length === 0) {
    sizesListDashboard.innerHTML = `
      <p class="empty-message" style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.9rem;">
        No hay tamaños configurados
      </p>
    `
    return
  }

  const html = currentProductSizes.map(size => `
    <div class="option-item" data-size-id="${size.id}">
      <div class="option-item-info">
        <span class="option-item-name">${size.name}</span>
        <span class="option-item-price">$${Number(size.price).toLocaleString('es-CO')}</span>
      </div>
      <div class="option-item-actions">
        <button class="btn-icon edit-size" data-size-id="${size.id}" title="Editar">
          <i class="ri-edit-line"></i>
        </button>
        <button class="btn-icon danger delete-size" data-size-id="${size.id}" title="Eliminar">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>
  `).join('')

  sizesListDashboard.innerHTML = html

  // Attach event listeners
  document.querySelectorAll('.edit-size').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sizeId = e.currentTarget.dataset.sizeId
      openSizeModal(sizeId)
    })
  })

  document.querySelectorAll('.delete-size').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sizeId = e.currentTarget.dataset.sizeId
      deleteProductSize(sizeId)
    })
  })
}

/**
 * Open size modal for create/edit
 */
function openSizeModal(sizeId = null) {
  editingSizeId = sizeId

  if (sizeId) {
    const size = currentProductSizes.find(s => s.id === sizeId)
    if (size) {
      document.getElementById('sizeModalTitle').textContent = 'Editar Tamaño'
      sizeNameInput.value = size.name
      sizePriceInput.value = size.price
    }
  } else {
    document.getElementById('sizeModalTitle').textContent = 'Nuevo Tamaño'
    sizeForm.reset()
  }

  sizeModal.style.display = 'flex'
}

/**
 * Close size modal
 */
function closeSizeModalFunc() {
  sizeModal.style.display = 'none'
  sizeForm.reset()
  editingSizeId = null
}

/**
 * Handle size form submit
 */
async function handleSizeFormSubmit(e) {
  e.preventDefault()

  if (!currentProductForOptions) return

  const sizeData = {
    product_id: currentProductForOptions.id,
    name: sizeNameInput.value.trim(),
    price: parseFloat(sizePriceInput.value),
    display_order: currentProductSizes.length
  }

  const loadingToast = notify.loading(editingSizeId ? 'Actualizando tamaño...' : 'Creando tamaño...')

  try {
    if (editingSizeId) {
      await productSizesService.update(editingSizeId, sizeData)
      notify.updateLoading(loadingToast, 'Tamaño actualizado', 'success')
    } else {
      await productSizesService.create(sizeData)
      notify.updateLoading(loadingToast, 'Tamaño creado', 'success')
    }

    closeSizeModalFunc()
    await loadProductSizes(currentProductForOptions.id)
    renderProductSizesDashboard()
  } catch (error) {
    console.error('Error saving size:', error)
    notify.updateLoading(loadingToast, 'Error al guardar el tamaño', 'error')
  }
}

/**
 * Delete a product size
 */
async function deleteProductSize(sizeId) {
  const result = await confirm.show({
    title: '¿Eliminar tamaño?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando tamaño...')

  try {
    await productSizesService.delete(sizeId)
    notify.updateLoading(loadingToast, 'Tamaño eliminado', 'success')
    await loadProductSizes(currentProductForOptions.id)
    renderProductSizesDashboard()
  } catch (error) {
    console.error('Error deleting size:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar el tamaño', 'error')
  }
}


// ============================================
// PROMOTIONS MANAGEMENT
// ============================================
const addPromotionBtn = document.getElementById('addPromotionBtn')
const promotionsList = document.getElementById('promotionsList')
const promotionModal = document.getElementById('promotionModal')
const closePromotionModal = document.getElementById('closePromotionModal')
const cancelPromotionBtn = document.getElementById('cancelPromotionBtn')
const savePromotionBtn = document.getElementById('savePromotionBtn')
const promotionImageInput = document.getElementById('promotionImageInput')
const promotionImagePreview = document.getElementById('promotionImagePreview')
const promotionImageActions = document.getElementById('promotionImageActions')
const promotionImageUrlHidden = document.getElementById('promotionImageUrlHidden')

// Initialize Promotions listeners
if (addPromotionBtn) addPromotionBtn.addEventListener('click', () => openPromotionModal())
if (closePromotionModal) closePromotionModal.addEventListener('click', closePromotionModalFunc)
if (cancelPromotionBtn) cancelPromotionBtn.addEventListener('click', closePromotionModalFunc)

// Image Upload Logic for Promotion
if (promotionImagePreview) {
  promotionImagePreview.addEventListener('click', () => {
    promotionImageInput.click()
  })
}

if (document.getElementById('changePromotionImageBtn')) {
  document.getElementById('changePromotionImageBtn').addEventListener('click', () => {
    promotionImageInput.click()
  })
}

if (document.getElementById('removePromotionImageBtn')) {
  document.getElementById('removePromotionImageBtn').addEventListener('click', async () => {
    const result = await confirm.show({
      title: '¿Eliminar imagen?',
      message: 'La imagen se borrará permanentemente.',
      confirmText: 'Eliminar',
      type: 'danger'
    })

    if (!result) return

    // If it's an existing image (url), we don't delete immediately from storage unless saved
    // But for UI, we clear it. In a robust app, we should mark for deletion.
    resetPromotionImageUpload()
  })
}

if (promotionImageInput) {
  promotionImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const progressDiv = document.getElementById('promotionImageProgress')
    const progressBar = progressDiv.querySelector('.progress-fill')

    // UI update
    progressDiv.style.display = 'flex'
    progressBar.style.width = '0%'

    try {
      // Resize image (16:9 optimized, e.g. 1280x720)
      const resizedFile = await imageService.resizeImage(file, 1280, 720, 0.9)

      // Simulate progress
      progressBar.style.width = '50%'

      // Upload
      const result = await imageService.upload(resizedFile, 'promotions')

      if (result.success) {
        progressBar.style.width = '100%'

        // Save URL
        currentPromotionImage = result.url
        promotionImageUrlHidden.value = result.url

        // Show preview
        promotionImagePreview.innerHTML = `<img src="${result.url}" alt="Preview" style="object-fit:cover; width:100%; height:100%; border-radius:8px;">`
        promotionImagePreview.classList.add('has-image')
        promotionImageActions.style.display = 'flex'

        setTimeout(() => {
          progressDiv.style.display = 'none'
        }, 500)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      notify.error('Error al subir imagen: ' + error.message)
      progressDiv.style.display = 'none'
    }
  })
}

function resetPromotionImageUpload() {
  currentPromotionImage = null
  promotionImageUrlHidden.value = ''
  promotionImageInput.value = ''

  promotionImagePreview.innerHTML = `
    <i class="ri-image-add-line"></i>
    <p>Click para seleccionar imagen</p>
    <small>Recomendado: 1280x720px (16:9)</small>
  `
  promotionImagePreview.classList.remove('has-image')
  promotionImageActions.style.display = 'none'
}



async function loadPromotions() {
  try {
    promotions = await promotionsService.getByBusiness(currentBusiness.id)
    renderPromotions()
  } catch (error) {
    console.error('Error loading promotions:', error)
    notify.error('Error al cargar promociones')
  }
}

function renderPromotions() {
  if (!promotionsList) return

  if (promotions.length === 0) {
    promotionsList.innerHTML = '<p class="empty-message">No hay promociones activas</p>'
    return
  }

  promotionsList.innerHTML = promotions.map(promo => `
    <div class="promotion-item card-item" data-id="${promo.id}">
      <div class="promotion-image">
        ${promo.image_url
      ? `<img src="${promo.image_url}" alt="${promo.title}">`
      : '<div class="no-image"><i class="ri-image-line"></i></div>'}
      </div>
      <div class="promotion-info">
        <h3>${promo.title}</h3>
        <p class="promotion-price">$${parseFloat(promo.price).toLocaleString()}</p>
        <p class="promotion-status ${promo.is_active ? 'active' : 'inactive'}">
          ${promo.is_active ? 'Activa' : 'Inactiva'}
        </p>
      </div>
      <div class="promotion-actions">
        <button class="btn-manage-options manage-promotion-options" data-id="${promo.id}">
          <i class="ri-settings-3-line"></i> Opciones
        </button>
        <button class="btn-icon edit-promotion" data-id="${promo.id}">
          <i class="ri-edit-line"></i>
        </button>
        <button class="btn-icon danger delete-promotion" data-id="${promo.id}">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    </div>
  `).join('')

  // Listeners
  document.querySelectorAll('.manage-promotion-options').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id
      openPromotionOptionsModal(id)
    })
  })

  document.querySelectorAll('.edit-promotion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id
      openPromotionModal(id)
    })
  })

  document.querySelectorAll('.delete-promotion').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.dataset.id
      deletePromotion(id)
    })
  })
}

// Helper to get local ISO string for datetime-local input
function toLocalISOString(date) {
  const pad = (num) => (num < 10 ? '0' : '') + num
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function openPromotionModal(promotionId = null) {
  resetPromotionImageUpload()

  if (promotionId) {
    editingPromotion = promotions.find(p => p.id === promotionId)
    document.getElementById('promotionModalTitle').textContent = 'Editar Promoción'

    // Fill fields
    document.getElementById('promotionTitleInput').value = editingPromotion.title
    document.getElementById('promotionPriceInput').value = editingPromotion.price
    document.getElementById('promotionDescriptionInput').value = editingPromotion.description || ''

    // Use local time for inputs
    if (editingPromotion.start_date) {
      document.getElementById('promotionStartDate').value = toLocalISOString(new Date(editingPromotion.start_date))
    }
    if (editingPromotion.end_date) {
      document.getElementById('promotionEndDate').value = toLocalISOString(new Date(editingPromotion.end_date))
    }

    document.getElementById('promotionActiveInput').checked = editingPromotion.is_active

    // Image
    if (editingPromotion.image_url) {
      currentPromotionImage = editingPromotion.image_url
      promotionImageUrlHidden.value = editingPromotion.image_url
      promotionImagePreview.innerHTML = `<img src="${editingPromotion.image_url}" alt="Preview" style="object-fit:cover; width:100%; height:100%; border-radius:8px;">`
      promotionImagePreview.classList.add('has-image')
      promotionImageActions.style.display = 'flex'
    }

  } else {
    editingPromotion = null
    document.getElementById('promotionModalTitle').textContent = 'Nueva Promoción'
    document.getElementById('promotionForm').reset()
    document.getElementById('promotionActiveInput').checked = true

    // Set default start/end dates for convenience (e.g. today now, end in 7 days)
    // Optional but helpful
  }

  promotionModal.style.display = 'flex'
}

function closePromotionModalFunc() {
  promotionModal.style.display = 'none'
  editingPromotion = null
}

// ============================================
// PROMOTION OPTIONS MANAGEMENT (Like Product Options)
// ============================================
let currentPromotionForOptions = null
let promotionQuickComments = []
let promotionSides = []

// Modal elements (reuse product options modal)
const promotionOptionsModal = document.getElementById('productOptionsModal')
const optionsPromotionName = document.getElementById('optionsProductName')

async function openPromotionOptionsModal(promotionId) {
  const promotion = promotions.find(p => p.id === promotionId)
  if (!promotion) return

  currentPromotionForOptions = promotion
  currentProductForOptions = null // Clear product context

  optionsPromotionName.textContent = promotion.title

  await loadPromotionOptions(promotion.id)
  renderPromotionOptionsDashboard()

  promotionOptionsModal.style.display = 'flex'
}

async function loadPromotionOptions(promotionId) {
  try {
    const options = await promotionOptionsService.getByPromotion(promotionId)
    promotionQuickComments = options.filter(opt => opt.type === 'quick_comment')
    promotionSides = options.filter(opt => opt.type === 'side')
  } catch (error) {
    console.error('Error loading promotion options:', error)
    promotionQuickComments = []
    promotionSides = []
  }
}

function renderPromotionOptionsDashboard() {
  const quickCommentsListDashboard = document.getElementById('quickCommentsListDashboard')
  const sidesListDashboard = document.getElementById('sidesListDashboard')

  // Render quick comments
  if (promotionQuickComments.length > 0) {
    quickCommentsListDashboard.innerHTML = promotionQuickComments.map(comment => `
      <div class="option-item">
        <span>${comment.name}</span>
        <div class="option-actions">
          <button class="btn-icon-small edit-promo-option" data-id="${comment.id}" data-type="quick_comment">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-icon-small danger delete-promo-option" data-id="${comment.id}">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `).join('')
  } else {
    quickCommentsListDashboard.innerHTML = '<p class="empty-message" style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.9rem;">No hay comentarios rápidos</p>'
  }

  // Render sides
  if (promotionSides.length > 0) {
    sidesListDashboard.innerHTML = promotionSides.map(side => `
      <div class="option-item">
        <span>${side.name} (+$${parseFloat(side.price).toLocaleString()})</span>
        <div class="option-actions">
          <button class="btn-icon-small edit-promo-option" data-id="${side.id}" data-type="side">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-icon-small danger delete-promo-option" data-id="${side.id}">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `).join('')
  } else {
    sidesListDashboard.innerHTML = '<p class="empty-message" style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.9rem;">No hay acompañantes</p>'
  }

  // Add listeners
  document.querySelectorAll('.edit-promo-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      const type = btn.dataset.type
      openPromotionOptionEditModal(id, type)
    })
  })

  document.querySelectorAll('.delete-promo-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id
      deletePromotionOption(id)
    })
  })
}

// Override add buttons to work for promotions (already declared earlier)
// const addQuickCommentBtn = document.getElementById('addQuickCommentBtn')
// const addSideBtn = document.getElementById('addSideBtn')

// Store original listeners
const originalAddCommentListener = addQuickCommentBtn.onclick
const originalAddSideListener = addSideBtn.onclick

// Replace with dynamic listeners
addQuickCommentBtn.onclick = null
addSideBtn.onclick = null

addQuickCommentBtn.addEventListener('click', () => {
  if (currentPromotionForOptions) {
    openPromotionOptionEditModal(null, 'quick_comment')
  } else if (currentProductForOptions) {
    openOptionModal('quick_comment')
  }
})

addSideBtn.addEventListener('click', () => {
  if (currentPromotionForOptions) {
    openPromotionOptionEditModal(null, 'side')
  } else if (currentProductForOptions) {
    openOptionModal('side')
  }
})

let editingPromotionOption = null
let editingPromotionOptionType = null

function openPromotionOptionEditModal(optionId = null, type) {
  editingPromotionOptionType = type

  if (optionId) {
    const allOptions = [...promotionQuickComments, ...promotionSides]
    editingPromotionOption = allOptions.find(opt => opt.id === optionId)

    optionModalTitle.textContent = type === 'quick_comment' ? 'Editar Comentario' : 'Editar Acompañante'
    optionNameInput.value = editingPromotionOption.name
    optionPriceInput.value = editingPromotionOption.price || 0
  } else {
    editingPromotionOption = null
    optionModalTitle.textContent = type === 'quick_comment' ? 'Nuevo Comentario Rápido' : 'Nuevo Acompañante'
    optionNameInput.value = ''
    optionPriceInput.value = 0
  }

  if (type === 'quick_comment') {
    optionPriceGroup.style.display = 'none'
  } else {
    optionPriceGroup.style.display = 'flex'
  }

  optionModal.style.display = 'flex'
}

async function deletePromotionOption(optionId) {
  const result = await confirm.show({
    title: '¿Eliminar opción?',
    message: 'Esta acción no se puede deshacer',
    confirmText: 'Eliminar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando opción...')

  try {
    await promotionOptionsService.delete(optionId)
    notify.updateLoading(loadingToast, 'Opción eliminada', 'success')
    await loadPromotionOptions(currentPromotionForOptions.id)
    renderPromotionOptionsDashboard()
  } catch (error) {
    console.error('Error deleting option:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar la opción', 'error')
  }
}


document.getElementById('promotionForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('promotionTitleInput').value
  const price = parseFloat(document.getElementById('promotionPriceInput').value)
  const description = document.getElementById('promotionDescriptionInput').value
  const startDateStr = document.getElementById('promotionStartDate').value
  const endDateStr = document.getElementById('promotionEndDate').value
  const isActive = document.getElementById('promotionActiveInput').checked

  // DATE VALIDATION
  const now = new Date()

  if (startDateStr) {
    const startDate = new Date(startDateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Allow start date to be today (even if time is slightly past, as long as it's today)
    // Or if editing, we might want to allow past start dates. 
    // But user requested "validemos que las fechas de inicio ... no deben ser anteriores al día actual"
    // Let's implement strict check for NEW promotions or if start date changed.
    // For simplicity, we just check against "today" (beginning of day) to minimize timezone frustration.

    if (startDate < today && !editingPromotion) {
      // Only enforce "not past" for new promotions to avoid locking old ones
      notify.warning('La fecha de inicio no puede ser anterior a hoy')
      return
    }

    if (endDateStr) {
      const endDate = new Date(endDateStr)
      if (endDate <= startDate) {
        notify.warning('La fecha de cierre debe ser posterior a la de inicio')
        return
      }

      if (endDate < now) {
        notify.warning('La fecha de cierre no puede estar en el pasado')
        return
      }
    }
  }

  const submitBtn = e.submitter || document.querySelector('#promotionForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      // Convert local inputs to UTC ISO strings for storage
      const startDateISO = startDateStr ? new Date(startDateStr).toISOString() : null
      const endDateISO = endDateStr ? new Date(endDateStr).toISOString() : null

      const promotionData = {
        business_id: currentBusiness.id,
        title,
        price,
        description,
        start_date: startDateISO,
        end_date: endDateISO,
        is_active: isActive,
        image_url: promotionImageUrlHidden.value || null
      }

      if (editingPromotion) {
        await promotionsService.update(editingPromotion.id, promotionData)
        notify.success('Promoción actualizada')
      } else {
        await promotionsService.create(promotionData)
        notify.success('Promoción creada')
      }

      closePromotionModalFunc()
      loadPromotions()

    } catch (error) {
      console.error('Error saving promotion:', error)
      notify.error('Error al guardar la promoción')
    }
  }, 'Guardando...')
})

// Delete Promotion
async function deletePromotion(id) {
  const result = await confirm.show({
    title: '¿Eliminar promoción?',
    message: 'No podrás recuperarla.',
    confirmText: 'Eliminar',
    type: 'danger'
  })

  if (!result) return

  try {
    await promotionsService.delete(id)
    notify.success('Promoción eliminada')
    await loadPromotions()
  } catch (error) {
    notify.error('Error al eliminar')
  }
}

// Override switchSection to load promotions if needed
// We need to inject this into the existing switchSection or handle it separate
// Since we can't easily inject inside the function without replacing it,
// we will assume switchSection calls are event driven. 
// We just need to make sure when 'promotions' section is active, we load data.

// Better approach: redefine switchSection? No, too risky.
// Let's modify the navItem click listener? No.
// Let's just add a mutation observer or a periodic check? No.

// Let's look at `switchSection` in original file. It just toggles display.
// We need to add the logic to load data.
// We can monkey-patch `switchSection` or similar.
// Or we can add a listener to the nav item directly that ALSO loads the data.

const promotionsNavItem = document.querySelector('.nav-item[data-section="promotions"]')
if (promotionsNavItem) {
  promotionsNavItem.addEventListener('click', () => {
    loadPromotions()
  })
}

// Add 'promotions' to updatePageTitle map (it was inside the function scope so we can't easily reach it 
// unless we replace the whole function or file).
// Since we are replacing a large block, let's include the necessary imports at top and add the logic.

// ============================================
// IMAGE UPLOAD FOR PRODUCTS
// ============================================

let currentProductImage = null
let uploadedImagePath = null


const productImagePreview = document.getElementById('productImagePreview')
const productImageInput = document.getElementById('productImageInput')
const imageUploadActions = document.getElementById('imageUploadActions')
const imageUploadProgress = document.getElementById('imageUploadProgress')
const changeImageBtn = document.getElementById('changeImageBtn')
const removeImageBtn = document.getElementById('removeImageBtn')
const productImageUrlHidden = document.getElementById('productImageUrlHidden')

// Click en preview para abrir selector de archivos
productImagePreview.addEventListener('click', () => {
  productImageInput.click()
})

// Cambiar imagen
changeImageBtn.addEventListener('click', () => {
  productImageInput.click()
})

// Cuando se selecciona un archivo
productImageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  let loadingToast = null

  try {
    // Mostrar progress y notificación
    imageUploadProgress.style.display = 'block'
    imageUploadActions.style.display = 'none'
    loadingToast = notify.loading('Subiendo imagen...')

    // Redimensionar imagen antes de subir
    const resizedFile = await imageService.resizeImage(file, 800, 800, 0.85)

    // Subir imagen
    const result = await imageService.upload(resizedFile, 'products')

    if (!result.success) {
      throw new Error(result.error)
    }

    // Guardar datos
    currentProductImage = result.url
    uploadedImagePath = result.path
    productImageUrlHidden.value = result.url

    // Mostrar preview
    productImagePreview.innerHTML = `<img src="${result.url}" alt="Preview">`
    productImagePreview.classList.add('has-image')

    // Mostrar botones de acción
    imageUploadProgress.style.display = 'none'
    imageUploadActions.style.display = 'flex'

    // Actualizar notificación a éxito
    notify.updateLoading(loadingToast, 'Imagen subida correctamente', 'success')

  } catch (error) {
    console.error('Error uploading image:', error)

    if (loadingToast) {
      notify.updateLoading(loadingToast, 'Error al subir la imagen: ' + error.message, 'error')
    } else {
      notify.error('Error al subir la imagen: ' + error.message)
    }

    imageUploadProgress.style.display = 'none'
  }
})

// Eliminar imagen
removeImageBtn.addEventListener('click', async () => {
  const result = await confirm.show({
    title: '¿Eliminar imagen?',
    message: 'Podrás subir otra imagen después.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'warning'
  })

  if (!result) return

  try {
    // Si hay una imagen subida previamente, eliminarla del storage
    if (uploadedImagePath) {
      await imageService.delete(uploadedImagePath)
    }

    // Resetear preview
    productImagePreview.innerHTML = `
      <i class="ri-image-line"></i>
      <p>Click para seleccionar imagen</p>
      <small>JPG, PNG o WEBP (máx. 5MB)</small>
    `
    productImagePreview.classList.remove('has-image')

    currentProductImage = null
    uploadedImagePath = null
    productImageUrlHidden.value = ''
    imageUploadActions.style.display = 'none'

    notify.success('Imagen eliminada')

  } catch (error) {
    console.error('Error deleting image:', error)
    notify.error('Error al eliminar la imagen')
  }
})

// Resetear imagen al cerrar modal de producto
function resetProductImageUpload() {
  productImagePreview.innerHTML = `
    <i class="ri-image-line"></i>
    <p>Click para seleccionar imagen</p>
    <small>JPG, PNG o WEBP (máx. 5MB)</small>
  `
  productImagePreview.classList.remove('has-image')
  currentProductImage = null
  uploadedImagePath = null
  productImageUrlHidden.value = ''
  imageUploadActions.style.display = 'none'
  imageUploadProgress.style.display = 'none'
  productImageInput.value = ''
}

copyLinkBtn.addEventListener('click', async () => {
  const url = catalogLink.href
  try {
    await navigator.clipboard.writeText(url)
    notify.success('Enlace copiado al portapapeles')
  } catch (error) {
    notify.error('No se pudo copiar el enlace')
  }
})

// ============================================
// WIZARD ONBOARDING - SIMPLE
// ============================================

let wizardCurrentStep = 1
let wizardData = {
  business: null,
  categories: [],
  categoriesIds: [] // IDs reales de Supabase
}

// Elementos del wizard
const wizardStep1 = document.getElementById('wizard-step-1')
const wizardStep2 = document.getElementById('wizard-step-2')
const wizardStep3 = document.getElementById('wizard-step-3')
const wizardStep4 = document.getElementById('wizard-step-4')

const wizardBusinessForm = document.getElementById('wizardBusinessForm')
const wizCategoryInput = document.getElementById('wiz-category-input')
const wizAddCategoryBtn = document.getElementById('wiz-add-category')
const wizCategoriesDisplay = document.getElementById('wiz-categories-display')
const wizSkipCategoriesBtn = document.getElementById('wiz-skip-categories')
const wizContinueCategoriesBtn = document.getElementById('wiz-continue-categories')
const wizSkipProductBtn = document.getElementById('wiz-skip-product')
const wizContinueProductBtn = document.getElementById('wiz-continue-product')
const wizFinishBtn = document.getElementById('wiz-finish')

// Step 1: Crear negocio
if (wizardBusinessForm) {
  wizardBusinessForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const name = document.getElementById('wiz-business-name').value.trim()
    const whatsapp = document.getElementById('wiz-whatsapp').value.trim()
    const address = document.getElementById('wiz-address').value.trim()
    const description = document.getElementById('wiz-description').value.trim()

    const submitBtn = e.submitter

    await buttonLoader.execute(submitBtn, async () => {
      try {
        const slug = businessService.generateSlug(name)
        const businessData = {
          name,
          slug,
          whatsapp_number: whatsapp,
          address: address || null,
          description,
          logo_url: wizardLogoUrl || null
        }

        const createdBusiness = await businessService.createBusiness(businessData)
        wizardData.business = createdBusiness

        notify.success('Negocio creado correctamente')
        showWizardStep(2)

      } catch (error) {
        console.error('Error creating business:', error)
        notify.error('Error al crear el negocio: ' + error.message)
      }
    }, 'Creando...')
  })
}

// Step 2: Agregar categoría
if (wizAddCategoryBtn) {
  wizAddCategoryBtn.addEventListener('click', addWizardCategory)
}

if (wizCategoryInput) {
  wizCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addWizardCategory()
    }
  })
}

function addWizardCategory() {
  const value = wizCategoryInput.value.trim()

  if (!value) {
    notify.warning('Escribe el nombre de la categoría')
    return
  }

  if (wizardData.categories.includes(value)) {
    notify.warning('Esta categoría ya existe')
    return
  }

  wizardData.categories.push(value)
  wizCategoryInput.value = ''
  wizCategoryInput.focus()

  renderWizardCategories()
  notify.success(`"${value}" agregada`)
}

function removeWizardCategory(index) {
  wizardData.categories.splice(index, 1)
  renderWizardCategories()
}

function renderWizardCategories() {
  if (!wizCategoriesDisplay) return

  wizCategoriesDisplay.innerHTML = ''

  wizardData.categories.forEach((cat, index) => {
    const tag = document.createElement('div')
    tag.className = 'category-tag'

    const nameSpan = document.createElement('span')
    nameSpan.className = 'category-tag-name'
    nameSpan.textContent = cat

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'category-tag-remove'
    removeBtn.innerHTML = '<i class="ri-close-line"></i>'
    removeBtn.onclick = () => removeWizardCategory(index)

    tag.appendChild(nameSpan)
    tag.appendChild(removeBtn)
    wizCategoriesDisplay.appendChild(tag)
  })
}

// Continuar desde categorías
if (wizContinueCategoriesBtn) {
  wizContinueCategoriesBtn.addEventListener('click', async () => {
    await buttonLoader.execute(wizContinueCategoriesBtn, async () => {
      await saveWizardCategories()
      updateProductCategorySelect()
      showWizardStep(3)
    }, 'Guardando...')
  })
}

// Omitir categorías
if (wizSkipCategoriesBtn) {
  wizSkipCategoriesBtn.addEventListener('click', () => {
    updateProductCategorySelect()
    showWizardStep(3)
  })
}

async function saveWizardCategories() {
  try {
    if (wizardData.categories.length > 0) {
      const promises = wizardData.categories.map((cat, index) => {
        return categoryService.create({
          business_id: wizardData.business.id,
          name: cat,
          display_order: index
        })
      })

      const createdCategories = await Promise.all(promises)
      wizardData.categoriesIds = createdCategories.map(c => c.id)

      notify.success('Categorías guardadas')
    }
  } catch (error) {
    console.error('Error saving categories:', error)
    notify.error('Error al guardar las categorías')
    throw error
  }
}

// Actualizar select de categorías en paso 3
function updateProductCategorySelect() {
  const selectGroup = document.getElementById('wiz-product-category-group')
  const select = document.getElementById('wiz-product-category')

  if (wizardData.categories.length > 0 && selectGroup && select) {
    selectGroup.style.display = 'flex'
    select.innerHTML = '<option value="">Sin categoría</option>' +
      wizardData.categories.map((cat, index) =>
        `<option value="${wizardData.categoriesIds[index] || ''}">${cat}</option>`
      ).join('')
  }
}

// Step 3: Producto
if (wizContinueProductBtn) {
  wizContinueProductBtn.addEventListener('click', async () => {
    await buttonLoader.execute(wizContinueProductBtn, async () => {
      await saveWizardProduct()
      showWizardStep(4)
    }, 'Finalizando...')
  })
}

if (wizSkipProductBtn) {
  wizSkipProductBtn.addEventListener('click', () => {
    showWizardStep(4)
  })
}

async function saveWizardProduct() {
  try {
    const name = document.getElementById('wiz-product-name').value.trim()
    const price = document.getElementById('wiz-product-price').value
    const categoryId = document.getElementById('wiz-product-category').value || null
    const description = document.getElementById('wiz-product-description').value.trim()

    if (name && price) {
      await productService.create({
        business_id: wizardData.business.id,
        name,
        price: parseFloat(price),
        category_id: categoryId,
        description,
        image_url: '',
        is_available: true,
        display_order: 0
      })

      wizardData.product = name
      notify.success('Producto creado')
    }
  } catch (error) {
    console.error('Error saving product:', error)
    notify.error('Error al crear el producto')
    throw error
  }
}

// Finalizar wizard
if (wizFinishBtn) {
  wizFinishBtn.addEventListener('click', () => {
    window.location.reload()
  })
}

// Mostrar paso del wizard
function showWizardStep(step) {
  wizardCurrentStep = step

  // Ocultar todos los pasos
  if (wizardStep1) wizardStep1.style.display = 'none'
  if (wizardStep2) wizardStep2.style.display = 'none'
  if (wizardStep3) wizardStep3.style.display = 'none'
  if (wizardStep4) wizardStep4.style.display = 'none'

  // Mostrar paso actual
  if (step === 1 && wizardStep1) wizardStep1.style.display = 'block'
  if (step === 2 && wizardStep2) wizardStep2.style.display = 'block'
  if (step === 3 && wizardStep3) wizardStep3.style.display = 'block'
  if (step === 4 && wizardStep4) wizardStep4.style.display = 'block'

  // Actualizar progress
  document.querySelectorAll('.progress-step').forEach((el, index) => {
    const stepNum = index + 1
    if (stepNum < step) {
      el.classList.add('completed')
      el.classList.remove('active')
    } else if (stepNum === step) {
      el.classList.add('active')
      el.classList.remove('completed')
    } else {
      el.classList.remove('active', 'completed')
    }
  })

  // Actualizar líneas de progreso
  document.querySelectorAll('.progress-line').forEach((line, index) => {
    if (index + 1 < step) {
      line.style.background = 'var(--color-primary)'
    } else {
      line.style.background = '#e5e7eb'
    }
  })

  // Llenar resumen en paso 4
  if (step === 4) {
    const summaryBusinessName = document.getElementById('summary-business-name')
    const summaryCategories = document.getElementById('summary-categories-box')
    const summaryCategoriesText = document.getElementById('summary-categories-text')
    const summaryProduct = document.getElementById('summary-product-box')
    const summaryProductText = document.getElementById('summary-product-text')

    if (summaryBusinessName && wizardData.business) {
      summaryBusinessName.textContent = wizardData.business.name
    }

    if (summaryCategories && summaryCategoriesText) {
      if (wizardData.categories.length > 0) {
        summaryCategories.style.display = 'flex'
        summaryCategoriesText.textContent = `${wizardData.categories.length} categoría${wizardData.categories.length > 1 ? 's' : ''}`
      } else {
        summaryCategories.style.display = 'none'
      }
    }

    if (summaryProduct && summaryProductText && wizardData.product) {
      summaryProduct.style.display = 'flex'
      summaryProductText.textContent = wizardData.product
    }
  }
}

// ============================================
// WHATSAPP TEMPLATE EDITOR
// ============================================

const whatsappTemplateInput = document.getElementById('whatsappTemplateInput')
const saveTemplateBtn = document.getElementById('saveTemplateBtn')
const previewTemplateBtn = document.getElementById('previewTemplateBtn')
const templatePreview = document.getElementById('templatePreview')

// Inicializar: cargar plantilla actual
async function loadWhatsAppTemplate() {
  if (!currentBusiness) return

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('whatsapp_message_template')
      .eq('id', currentBusiness.id)
      .single()

    if (error) throw error

    if (data?.whatsapp_message_template) {
      whatsappTemplateInput.value = data.whatsapp_message_template
    } else {
      // Plantilla por defecto
      whatsappTemplateInput.value = `Hola, quiero hacer el siguiente pedido:

{productos}

Total: {total}

¡Gracias!`
    }
  } catch (error) {
    console.error('Error loading template:', error)
  }
}

// Insertar token al hacer clic
document.querySelectorAll('.token-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const token = btn.dataset.token
    const textarea = whatsappTemplateInput
    const cursorPos = textarea.selectionStart
    const textBefore = textarea.value.substring(0, cursorPos)
    const textAfter = textarea.value.substring(cursorPos)

    textarea.value = textBefore + token + textAfter
    textarea.focus()

    // Colocar cursor después del token insertado
    const newCursorPos = cursorPos + token.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)

    // Feedback visual
    btn.style.transform = 'scale(0.95)'
    setTimeout(() => {
      btn.style.transform = ''
    }, 150)
  })
})

// Guardar plantilla
if (saveTemplateBtn) {
  saveTemplateBtn.addEventListener('click', async () => {
    const template = whatsappTemplateInput.value.trim()

    if (!template) {
      notify.warning('La plantilla no puede estar vacía')
      return
    }

    // Validar token de domicilio si hay precio configurado
    // Se asume que si delivery_price > 0, es obligatorio mostrarlo
    if (currentBusiness.delivery_price > 0 && !template.includes('{valor de domicilio}')) {
      notify.warning('El token {valor de domicilio} es obligatorio porque tienes un precio de domicilio configurado.')
      return
    }

    await buttonLoader.execute(saveTemplateBtn, async () => {
      try {
        const { error } = await supabase
          .from('businesses')
          .update({ whatsapp_message_template: template })
          .eq('id', currentBusiness.id)

        if (error) throw error

        notify.success('Plantilla guardada correctamente')
      } catch (error) {
        console.error('Error saving template:', error)
        notify.error('Error al guardar la plantilla')
      }
    }, 'Guardando...')
  })
}

// Vista previa
if (previewTemplateBtn) {
  previewTemplateBtn.addEventListener('click', () => {
    const template = whatsappTemplateInput.value

    // Datos de ejemplo
    const exampleData = {
      productos: `- 2x Hamburguesa Clásica ($20.000)
  Con: Papas medianas, Gaseosa
- 1x Papas grandes ($8.000)`,
      total: '$48.000',
      nombre: 'Juan Pérez',
      direccion: 'Calle 123 #45-67, Apto 301',
      barrio: 'Recreo',
      telefono: '+57 300 123 4567',
      metodo_pago: 'Efectivo'
    }

    // Reemplazar tokens
    let preview = template
    Object.keys(exampleData).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      preview = preview.replace(regex, exampleData[key])
    })

    // Mostrar preview
    const previewBox = templatePreview.querySelector('.preview-box')
    previewBox.textContent = preview
    templatePreview.style.display = 'block'

    // Scroll suave hacia el preview
    templatePreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

// Cargar plantilla cuando se carga el negocio
// (esto ya se ejecuta en la función loadBusiness existente,
// solo necesitamos llamar a loadWhatsAppTemplate allí)


// ============================================
// WHATSAPP EDITOR TOOLBAR & EMOJI PICKER
// ============================================

const emojiCategories = {
  faces: ['😊', '😂', '🥰', '😍', '😎', '🤔', '😅', '😭', '🤯', '🥳', '😡', '😱', '👋', '👍', '👎', '👏', '🙏', '💪', '👀', '✨'],
  food: ['🍔', '🍕', '🌭', '🍟', '🌮', '🥗', '🍦', '🍩', '🍪', '🍫', '🍺', '🍷', '☕', '🥤', '🍎', '🍓', '🥑', '🥦', '🥩', '🥓'],
  objects: ['💡', '🎉', '🎁', '🎈', '🛒', '🛍️', '💰', '💳', '📱', '💻', '⌚', '📷', '🚲', '🚗', '✈️', '🏠', '💼', '📦', '🔔', '📅'],
  symbols: ['✅', '❌', '💲', '💯', '🔥', '⭐', '❤️', '💙', '💚', '💛', '💜', '🧡', '❗', '❓', '➡️', '⬅️', '⬆️', '⬇️', '🕒', '🏁']
}

function initWhatsAppEditor() {
  const toggleEmojiBtn = document.getElementById('toggleEmojiBtn')
  const emojiPicker = document.getElementById('emojiPicker')
  const emojiGrid = document.getElementById('emojiGrid')
  const emojiTabs = document.querySelectorAll('.emoji-tab')
  const textarea = whatsappTemplateInput

  // Formatting Buttons
  document.querySelectorAll('.toolbar-btn[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format
      let wrapper = ''

      if (format === 'bold') wrapper = '*'
      if (format === 'italic') wrapper = '_'
      if (format === 'monospace') wrapper = '```'

      insertWrapperAtCursor(textarea, wrapper)
    })
  })

  // Toggle Picker
  if (toggleEmojiBtn && emojiPicker) {
    toggleEmojiBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const isVisible = emojiPicker.style.display === 'block'
      emojiPicker.style.display = isVisible ? 'none' : 'block'

      if (!isVisible && emojiGrid.children.length === 0) {
        renderEmojis('faces') // Default category
      }
    })

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!emojiPicker.contains(e.target) && e.target !== toggleEmojiBtn && !toggleEmojiBtn.contains(e.target)) {
        emojiPicker.style.display = 'none'
      }
    })
  }

  // Category Tabs
  emojiTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      emojiTabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      renderEmojis(tab.dataset.category)
    })
  })

  // Render Emojis
  function renderEmojis(category) {
    if (!emojiGrid) return

    const emojis = emojiCategories[category] || []
    emojiGrid.innerHTML = emojis.map(emoji => `
          <button type="button" class="emoji-btn">${emoji}</button>
      `).join('')

    // Add listeners to new buttons
    emojiGrid.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        insertTextAtCursor(textarea, btn.textContent)
      })
    })
  }
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.substring(0, start)
  const after = textarea.value.substring(end)

  textarea.value = before + text + after

  // Trigger input event for auto-resize or other listeners
  textarea.dispatchEvent(new Event('input'))

  const newPos = start + text.length
  textarea.selectionStart = newPos
  textarea.selectionEnd = newPos
  textarea.focus()
}

function insertWrapperAtCursor(textarea, wrapper) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  if (start === end) {
    // No selection, insert empty wrapper
    const before = textarea.value.substring(0, start)
    const after = textarea.value.substring(end)
    textarea.value = before + wrapper + wrapper + after

    // Place cursor inside
    const newPos = start + wrapper.length
    textarea.selectionStart = newPos
    textarea.selectionEnd = newPos
  } else {
    // Wrap selection
    const before = textarea.value.substring(0, start)
    const selected = textarea.value.substring(start, end)
    const after = textarea.value.substring(end)

    textarea.value = before + wrapper + selected + wrapper + after

    const newPos = end + (wrapper.length * 2)
    textarea.selectionStart = newPos
    textarea.selectionEnd = newPos
  }
  textarea.dispatchEvent(new Event('input'))
  textarea.focus()
}

// ============================================
// PAYMENT METHODS MANAGEMENT
// ============================================

const paymentMethodsList = document.getElementById('paymentMethodsList')
const addPaymentMethodBtn = document.getElementById('addPaymentMethodBtn')
const paymentMethodModal = document.getElementById('paymentMethodModal')
const closePaymentMethodModal = document.getElementById('closePaymentMethodModal')
const cancelPaymentMethodBtn = document.getElementById('cancelPaymentMethodBtn')
const paymentMethodForm = document.getElementById('paymentMethodForm')
const paymentMethodModalTitle = document.getElementById('paymentMethodModalTitle')
const paymentMethodNameInput = document.getElementById('paymentMethodNameInput')

// Render payment methods list
function renderPaymentMethods() {
  if (!paymentMethodsList) return

  if (paymentMethods.length === 0) {
    paymentMethodsList.innerHTML = '<p class="empty-message">No hay métodos de pago configurados</p>'
    return
  }

  paymentMethodsList.innerHTML = paymentMethods.map(method => `
    <div class="payment-method-item" data-id="${method.id}">
      <div class="payment-method-info">
        <div class="payment-method-name">${method.name}</div>
      </div>
      <div class="payment-method-actions">
        <button class="btn-icon edit-payment-method" data-id="${method.id}">
          <i class="ri-edit-line"></i> Editar
        </button>
        <button class="btn-icon danger delete-payment-method" data-id="${method.id}">
          <i class="ri-delete-bin-line"></i> Eliminar
        </button>
      </div>
    </div>
  `).join('')

  // Event listeners
  document.querySelectorAll('.edit-payment-method').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.edit-payment-method').dataset.id
      openEditPaymentMethodModal(id)
    })
  })

  document.querySelectorAll('.delete-payment-method').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id || e.target.closest('.delete-payment-method').dataset.id
      deletePaymentMethod(id)
    })
  })
}

// Open modal to add payment method
if (addPaymentMethodBtn) {
  addPaymentMethodBtn.addEventListener('click', () => {
    openPaymentMethodModal()
  })
}

function openPaymentMethodModal() {
  editingPaymentMethod = null
  paymentMethodModalTitle.textContent = 'Nuevo Método de Pago'
  paymentMethodNameInput.value = ''
  paymentMethodModal.style.display = 'flex'
}

function openEditPaymentMethodModal(methodId) {
  editingPaymentMethod = paymentMethods.find(m => m.id === methodId)
  if (!editingPaymentMethod) return

  paymentMethodModalTitle.textContent = 'Editar Método de Pago'
  paymentMethodNameInput.value = editingPaymentMethod.name
  paymentMethodModal.style.display = 'flex'
}

function closePaymentMethodModalFn() {
  paymentMethodModal.style.display = 'none'
  editingPaymentMethod = null
  paymentMethodForm.reset()
}

if (closePaymentMethodModal) {
  closePaymentMethodModal.addEventListener('click', closePaymentMethodModalFn)
}

if (cancelPaymentMethodBtn) {
  cancelPaymentMethodBtn.addEventListener('click', closePaymentMethodModalFn)
}

// Save payment method
if (paymentMethodForm) {
  paymentMethodForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const name = paymentMethodNameInput.value.trim()
    const submitBtn = e.submitter || document.querySelector('#paymentMethodForm button[type="submit"]')

    await buttonLoader.execute(submitBtn, async () => {
      try {
        if (editingPaymentMethod) {
          // Update
          await paymentMethodsService.update(editingPaymentMethod.id, { name })
          notify.success('Método de pago actualizado')
        } else {
          // Create
          await paymentMethodsService.create({
            business_id: currentBusiness.id,
            name,
            is_active: true,
            display_order: paymentMethods.length
          })
          notify.success('Método de pago creado')
        }

        closePaymentMethodModalFn()
        await loadAllData()

      } catch (error) {
        console.error('Error saving payment method:', error)
        notify.error('Error al guardar el método de pago')
      }
    }, 'Guardando...')
  })
}

// Delete payment method
async function deletePaymentMethod(methodId) {
  const result = await confirm.show({
    title: '¿Eliminar método de pago?',
    message: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  })

  if (!result) return

  const loadingToast = notify.loading('Eliminando método de pago...')

  try {
    await paymentMethodsService.delete(methodId)
    notify.updateLoading(loadingToast, 'Método de pago eliminado', 'success')
    await loadAllData()
  } catch (error) {
    console.error('Error deleting payment method:', error)
    notify.updateLoading(loadingToast, 'Error al eliminar el método de pago', 'error')
  }
}

// ============================================
// BUSINESS HOURS MANAGEMENT
// ============================================

const businessHoursGrid = document.getElementById('businessHoursGrid')
const saveBusinessHoursBtn = document.getElementById('saveBusinessHoursBtn')

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Render business hours grid
function renderBusinessHours() {
  if (!businessHoursGrid) return

  // Crear horarios por defecto si no existen
  const hoursData = []
  for (let day = 0; day <= 6; day++) {
    const existingHour = businessHours.find(h => h.day_of_week === day)
    hoursData.push(existingHour || {
      day_of_week: day,
      is_open: day >= 1 && day <= 5, // Lunes a Viernes abierto por defecto
      open_time: '09:00',
      close_time: '18:00'
    })
  }

  businessHoursGrid.innerHTML = hoursData.map(hour => `
    <div class="business-hour-row">
      <div class="business-hour-day">
        <input 
          type="checkbox" 
          id="day-${hour.day_of_week}" 
          class="day-checkbox"
          data-day="${hour.day_of_week}"
          ${hour.is_open ? 'checked' : ''}
        >
        <label for="day-${hour.day_of_week}">${dayNames[hour.day_of_week]}</label>
      </div>
      <div class="business-hour-times">
        <div class="time-input-group">
          <label>Abre:</label>
          <input 
            type="time" 
            class="time-input open-time" 
            data-day="${hour.day_of_week}"
            value="${hour.open_time}"
            ${!hour.is_open ? 'disabled' : ''}
          >
        </div>
        <div class="time-input-group">
          <label>Cierra:</label>
          <input 
            type="time" 
            class="time-input close-time" 
            data-day="${hour.day_of_week}"
            value="${hour.close_time}"
            ${!hour.is_open ? 'disabled' : ''}
          >
        </div>
      </div>
    </div>
  `).join('')

  // Event listeners para checkboxes
  document.querySelectorAll('.day-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const day = parseInt(e.target.dataset.day)
      const openTimeInput = document.querySelector(`.open-time[data-day="${day}"]`)
      const closeTimeInput = document.querySelector(`.close-time[data-day="${day}"]`)

      if (e.target.checked) {
        openTimeInput.disabled = false
        closeTimeInput.disabled = false
      } else {
        openTimeInput.disabled = true
        closeTimeInput.disabled = true
      }
    })
  })
}

// Save business hours
if (saveBusinessHoursBtn) {
  saveBusinessHoursBtn.addEventListener('click', async () => {
    await buttonLoader.execute(saveBusinessHoursBtn, async () => {
      try {
        const hoursToSave = []

        for (let day = 0; day <= 6; day++) {
          const checkbox = document.querySelector(`.day-checkbox[data-day="${day}"]`)
          const openTime = document.querySelector(`.open-time[data-day="${day}"]`)
          const closeTime = document.querySelector(`.close-time[data-day="${day}"]`)

          hoursToSave.push({
            business_id: currentBusiness.id,
            day_of_week: day,
            is_open: checkbox.checked,
            open_time: openTime.value,
            close_time: closeTime.value
          })
        }

        await businessHoursService.upsert(hoursToSave)
        notify.success('Horarios guardados correctamente')
        await loadAllData()

      } catch (error) {
        console.error('Error saving business hours:', error)
        notify.error('Error al guardar los horarios')
      }
    }, 'Guardando...')
  })
}

// ============================================
// PRODUCT DISCOUNTS MANAGEMENT
// ============================================

// DOM Elements
const discountModal = document.getElementById('discountModal')
const closeDiscountModal = document.getElementById('closeDiscountModal')
const cancelDiscountBtn = document.getElementById('cancelDiscountBtn')
const discountForm = document.getElementById('discountForm')
const saveDiscountBtn = document.getElementById('saveDiscountBtn')
const deleteDiscountBtn = document.getElementById('deleteDiscountBtn')

// Form fields
const discountProductName = document.getElementById('discountProductName')
const discountActiveInput = document.getElementById('discountActiveInput')
const discountPercentage = document.getElementById('discountPercentage')
const discountedPrice = document.getElementById('discountedPrice')
const originalPrice = document.getElementById('originalPrice')
const discountStartDate = document.getElementById('discountStartDate')
const discountEndDate = document.getElementById('discountEndDate')
const discountProductId = document.getElementById('discountProductId')
const discountOriginalPrice = document.getElementById('discountOriginalPrice')

// Global function to open discount modal (called from product actions)
window.openDiscountModal = async function (productId) {
  try {
    const product = products.find(p => p.id === productId)
    if (!product) {
      notify.error('Producto no encontrado')
      return
    }

    // Set product info
    discountProductName.textContent = product.name
    discountProductId.value = productId
    discountOriginalPrice.value = product.price
    originalPrice.textContent = parseFloat(product.price).toLocaleString()

    // Load existing discount
    const existingDiscount = await productDiscountsService.getByProduct(productId)

    if (existingDiscount) {
      // Populate form with existing data
      discountActiveInput.checked = existingDiscount.is_active
      discountPercentage.value = existingDiscount.discount_percentage
      discountStartDate.value = existingDiscount.start_date
      discountEndDate.value = existingDiscount.end_date

      // Check if expired and update toggle visual state
      const todayStr = new Date().toISOString().split('T')[0]
      if (existingDiscount.end_date < todayStr) {
        discountActiveInput.checked = false
      }

      // Calculate and show discounted price
      updateDiscountedPrice()

      // Show delete button
      deleteDiscountBtn.style.display = 'inline-flex'
    } else {
      // Clear form for new discount
      discountActiveInput.checked = false
      discountPercentage.value = ''
      discountStartDate.value = ''
      discountEndDate.value = ''
      discountedPrice.value = ''

      // Hide delete button
      deleteDiscountBtn.style.display = 'none'
    }

    // Show modal
    discountModal.style.display = 'flex'
  } catch (error) {
    console.error('Error opening discount modal:', error)
    notify.error('Error al cargar los datos del descuento')
  }
}

// Update discounted price calculation
function updateDiscountedPrice() {
  const percentage = parseFloat(discountPercentage.value)
  const price = parseFloat(discountOriginalPrice.value)

  if (!percentage || !price || percentage <= 0 || percentage >= 100) {
    discountedPrice.value = ''
    return
  }

  const calculated = productDiscountsService.calculateDiscountedPrice(price, percentage)
  discountedPrice.value = `$${calculated.toLocaleString()}`
}

// Listen to percentage changes
if (discountPercentage) {
  discountPercentage.addEventListener('input', updateDiscountedPrice)
}

// Close modal handlers
if (closeDiscountModal) {
  closeDiscountModal.addEventListener('click', () => {
    discountModal.style.display = 'none'
  })
}

if (cancelDiscountBtn) {
  cancelDiscountBtn.addEventListener('click', () => {
    discountModal.style.display = 'none'
  })
}

// Save discount
if (discountForm) {
  discountForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    await buttonLoader.execute(saveDiscountBtn, async () => {
      try {
        const productId = discountProductId.value
        const percentage = parseFloat(discountPercentage.value)
        const startDate = discountStartDate.value
        const endDate = discountEndDate.value
        const isActive = discountActiveInput.checked


        // Validation logic
        if (isActive) {
          // Si se está activando, todas las validaciones son requeridas
          if (!percentage || percentage <= 0 || percentage >= 100) {
            notify.error('El porcentaje debe estar entre 1 y 99')
            return
          }

          if (!startDate || !endDate) {
            notify.error('Debes ingresar ambas fechas (inicio y fin)')
            return
          }

          // Validate dates using string comparison to avoid timezone issues
          const todayStr = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD

          if (startDate < todayStr) {
            notify.error('La fecha de inicio no puede ser anterior a hoy')
            return
          }

          if (endDate < startDate) {
            notify.error('La fecha fin no puede ser anterior a la fecha inicio')
            return
          }
        } else {
          // Si se está desactivando, solo validamos que el porcentaje sea válido si se ingresó algo
          // Las fechas no son obligatorias para desactivar
          if (percentage && (percentage <= 0 || percentage >= 100)) {
            notify.error('El porcentaje debe estar entre 1 y 99')
            return
          }
        }

        const discountData = {
          product_id: productId,
          discount_percentage: percentage,
          start_date: startDate,
          end_date: endDate,
          is_active: isActive
        }

        // Check if discount exists
        const existingDiscount = await productDiscountsService.getByProduct(productId)

        if (existingDiscount) {
          await productDiscountsService.update(productId, discountData)
          notify.success('Descuento actualizado correctamente')
        } else {
          await productDiscountsService.create(discountData)
          notify.success('Descuento creado correctamente')
        }

        discountModal.style.display = 'none'
      } catch (error) {
        console.error('Error saving discount:', error)
        notify.error('Error al guardar el descuento')
      }
    }, 'Guardando...')
  })
}

// Delete discount
if (deleteDiscountBtn) {
  deleteDiscountBtn.addEventListener('click', async () => {
    const confirmed = await confirm.show({
      title: '¿Eliminar descuento?',
      message: 'El descuento del producto será eliminado permanentemente.',
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    })
    if (!confirmed) return

    await buttonLoader.execute(deleteDiscountBtn, async () => {
      try {
        const productId = discountProductId.value
        await productDiscountsService.delete(productId)

        notify.success('Descuento eliminado correctamente')
        discountModal.style.display = 'none'
      } catch (error) {
        console.error('Error deleting discount:', error)
        notify.error('Error al eliminar el descuento')
      }
    }, 'Eliminando...')
  })
}

// ============================================
// ORDERS MANAGEMENT
// ============================================

function initOrders() {
  const searchInput = document.getElementById('searchOrdersInput')
  const statusFilter = document.getElementById('filterOrdersStatus')
  const clearSearchBtn = document.getElementById('clearOrdersSearch')
  const viewToggles = document.querySelectorAll('.view-toggle-btn')
  const orderDetailsModal = document.getElementById('orderDetailsModal')
  const closeDetailsBtn = document.getElementById('closeOrderDetailsBtn')
  const closeDetailsFooter = document.getElementById('closeOrderDetailsFooterBtn')
  const verifyBtn = document.getElementById('verifyOrderBtn')

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.trim().toLowerCase()
      if (term) clearSearchBtn.style.display = 'block'
      else clearSearchBtn.style.display = 'none'
      renderOrders()
    })
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = ''
      renderOrders()
      clearSearchBtn.style.display = 'none'
    })
  }

  // Filter Status
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      renderOrders()
    })
  }

  // View Toggles
  viewToggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view
      currentOrdersView = view

      // Update active state
      viewToggles.forEach(b => b.classList.remove('active'))
      e.currentTarget.classList.add('active')
      // Update style based on active class (CSS handles this usually, but enforcing JS style if needed)
      // Assuming CSS handles .active class

      renderOrders()
    })
  })

  // Modal Closers
  const closeFunc = () => {
    if (orderDetailsModal) orderDetailsModal.style.display = 'none'
  }
  if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeFunc)
  if (closeDetailsFooter) closeDetailsFooter.addEventListener('click', closeFunc)

  // Verify Action
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const orderId = verifyBtn.dataset.orderId
      if (orderId) {
        await verifyOrder(orderId)
        closeFunc()
      }
    })
  }

  // Initial Badge Count
  updateOrdersBadgeCount()

  // Note: Realtime subscription is initialized globally at dashboard load
  // No need to reinitialize here to avoid WebSocket conflicts
}

// Global Order Badge State
async function updateOrdersBadgeCount() {
  if (!currentBusiness) return
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', currentBusiness.id)
      .eq('status', 'pending')

    if (error) throw error

    // Find Sidebar Item
    const orderLink = document.querySelector('.nav-item[data-section="orders"]')
    if (orderLink) {
      // Check if badge exists
      let badge = orderLink.querySelector('.badge-count')
      // If it doesn't exist, create it
      if (!badge) {
        badge = document.createElement('span')
        badge.className = 'badge-count'
        // Styling matches a notification badge
        badge.style.cssText = 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 99px; font-size: 0.75rem; margin-left: auto; font-weight: 600; min-width: 18px; text-align: center;'
        orderLink.appendChild(badge)
      }

      if (count && count > 0) {
        badge.style.display = 'inline-block'
        badge.textContent = count > 99 ? '99+' : count
      } else {
        badge.style.display = 'none'
      }
    }
  } catch (error) {
    console.error('Error updating orders badge:', error)
  }
}

function initRealtimeOrders() {
  if (!currentBusiness) {
    return
  }

  // Create realtime subscription for orders
  const channel = supabase.channel('orders-realtime')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT and UPDATE
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${currentBusiness.id}`
      },
      (payload) => {
        // Handle INSERT (New Order)
        if (payload.eventType === 'INSERT') {
          notify.info('<i class="ri-notification-2-line"></i> Nuevo pedido recibido')
        }

        // Always update badge on any change (Insert or Update status)
        updateOrdersBadgeCount()

        // If currently on orders section, refresh list
        const ordersSection = document.getElementById('section-orders')
        if (ordersSection && ordersSection.style.display !== 'none') {
          loadOrders()
        }
      }
    )
    .subscribe()
}

// Load Orders (Paginated)
async function loadOrders(page = 1) {
  if (!currentBusiness) return

  const listContainer = document.getElementById('ordersListContainer')
  const paginationContainer = document.getElementById('ordersPagination')

  // Show loading state if needed (optional)

  try {
    ordersCurrentPage = page

    // Get Search Term
    const searchInput = document.getElementById('searchOrdersInput')
    const searchTerm = searchInput?.value.trim() || ''

    // Get Status Filter
    const status = currentOrderFilter

    const { data, count } = await ordersService.getByBusiness(currentBusiness.id, {
      page: ordersCurrentPage,
      limit: ordersItemsPerPage,
      status: status,
      search: searchTerm
    })

    orders = data || []
    ordersTotalCount = count || 0

    renderOrders()
    renderOrdersPagination()

    // Update badge on manual load
    updateOrdersBadgeCount()
  } catch (error) {
    console.error('Error loading orders:', error)
    notify.error('Error al cargar pedidos')
  }
}

function renderOrdersPagination() {
  const paginationContainer = document.getElementById('ordersPagination')
  const startCountEl = document.getElementById('ordersStartCount')
  const endCountEl = document.getElementById('ordersEndCount')
  const totalCountEl = document.getElementById('ordersTotalCount')
  const prevBtn = document.getElementById('prevOrdersPageBtn')
  const nextBtn = document.getElementById('nextOrdersPageBtn')
  const pageIndicator = document.getElementById('ordersPageIndicator')

  if (!paginationContainer || ordersTotalCount === 0) {
    if (paginationContainer) paginationContainer.style.display = 'none'
    return
  }

  paginationContainer.style.display = 'flex'

  const start = (ordersCurrentPage - 1) * ordersItemsPerPage + 1
  const end = Math.min(start + orders.length - 1, ordersTotalCount)

  startCountEl.textContent = start
  endCountEl.textContent = end
  totalCountEl.textContent = ordersTotalCount
  pageIndicator.textContent = `Página ${ordersCurrentPage}`

  prevBtn.disabled = ordersCurrentPage === 1
  nextBtn.disabled = end >= ordersTotalCount

  // Clean old listeners to avoid duplicates if re-rendering (though usually safe if elements are static)
  // Better to attach listeners once in init, but here we update state.
  // We will handle click events in initOrders or add them here if not present.
  // Actually, we should add listeners in initOrders to avoid duplicate bindings.
}

function renderOrders() {
  const container = document.getElementById('ordersListContainer')
  const tableBody = document.getElementById('ordersTableBody')
  const mosaicGrid = document.getElementById('ordersMosaicGrid')
  const noOrdersMsg = document.getElementById('noOrdersMessage')
  const searchInput = document.getElementById('searchOrdersInput')
  const statusFilter = document.getElementById('filterOrdersStatus')

  if (!container) return

  const searchTerm = searchInput?.value.trim().toLowerCase() || ''
  const statusTerm = statusFilter?.value || 'all'

  // Filter
  const filtered = orders.filter(order => {
    const matchesSearch =
      (order.customer_name?.toLowerCase().includes(searchTerm)) ||
      (order.customer_phone?.includes(searchTerm)) ||
      (order.id.slice(0, 8).includes(searchTerm))

    const matchesStatus = statusTerm === 'all' || order.status === statusTerm

    return matchesSearch && matchesStatus
  })

  if (filtered.length === 0) {
    container.style.display = 'none'
    if (noOrdersMsg) noOrdersMsg.style.display = 'block'
    return
  }

  container.style.display = 'block'
  if (noOrdersMsg) noOrdersMsg.style.display = 'none'

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  if (currentOrdersView === 'table') {
    // Table View
    const tableResp = document.querySelector('.table-responsive')
    if (tableResp) tableResp.style.display = 'block'
    if (mosaicGrid) mosaicGrid.style.display = 'none'

    if (tableBody) {
      tableBody.innerHTML = filtered.map(order => `
        <tr>
          <td>
            <div style="font-weight: 600; font-family: monospace;">#${order.id.slice(0, 8)}</div>
            <div style="font-size: 0.8rem; color: #6b7280;">${new Date(order.created_at).toLocaleDateString()} ${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </td>
          <td>
            <div style="font-weight: 500;">${order.customer_name}</div>
            <div style="font-size: 0.8rem; color: #6b7280;">${order.customer_phone}</div>
          </td>
          <td>
            <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.customer_address}">
              ${order.customer_address}
            </div>
            <div style="font-size: 0.8rem; color: #6b7280;">${order.customer_neighborhood || ''}</div>
          </td>
          <td class="order-total-amount">$${parseFloat(order.total_amount).toLocaleString()}</td>
          <td>${getOrderStatusBadge(order.status)}</td>
          <td style="text-align: right;">
            <button class="btn-icon ${order.internal_notes ? 'note-has-content' : ''}" onclick="window.editInternalNotes('${order.id}')" title="${order.internal_notes ? 'Editar nota interna' : 'Agregar nota interna'}">
              <i class="${order.internal_notes ? 'ri-sticky-note-fill' : 'ri-sticky-note-line'}"></i>
            </button>
            <button class="btn-icon" onclick="window.viewOrderDetails('${order.id}')" title="Ver detalles">
              <i class="ri-eye-line"></i>
            </button>
            ${order.status === 'pending' ?
          `<button class="btn-icon success" onclick="window.verifyOrder('${order.id}')" title="Verificar">
                <i class="ri-check-line"></i>
              </button>
              <button class="btn-icon danger" onclick="window.cancelOrder('${order.id}')" title="Cancelar Pedido">
                <i class="ri-close-line"></i>
              </button>` : ''
        }
            ${order.status === 'verified' ?
          `<button class="btn-icon" style="color: #7e22ce;" onclick="window.openAssignOrderModal('${order.id}', '${order.id.slice(0, 8)}')" title="Despachar Pedido">
                <i class="ri-motorbike-fill"></i>
              </button>
              <button class="btn-icon danger" onclick="window.cancelOrder('${order.id}')" title="Cancelar Pedido">
                <i class="ri-close-line"></i>
              </button>` : ''
        }
            ${order.status === 'dispatched' ?
          `<button class="btn-icon" style="color: #2563eb;" onclick="window.completeOrder('${order.id}')" title="Completar Pedido">
                <i class="ri-flag-line"></i>
              </button>
              <button class="btn-icon danger" onclick="window.cancelOrder('${order.id}')" title="Cancelar Pedido">
                <i class="ri-close-line"></i>
              </button>` : ''
        }
            <button class="btn-icon" onclick="window.printOrderInvoice('${order.id}')" title="Imprimir Factura">
              <i class="ri-printer-line"></i>
            </button>
          </td>
        </tr>
      `).join('')
    }

  } else {
    // Mosaic View
    const tableResp = document.querySelector('.table-responsive')
    if (tableResp) tableResp.style.display = 'none'
    if (mosaicGrid) {
      mosaicGrid.style.display = 'grid'
      mosaicGrid.innerHTML = filtered.map(order => `
        <div class="card" style="padding: 1rem; border: 1px solid #e5e7eb; box-shadow: none;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
             <span style="font-weight: 600; font-family: monospace;">#${order.id.slice(0, 8)}</span>
             <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${getOrderStatusBadge(order.status)}
                <button class="btn-icon" onclick="window.printOrderInvoice('${order.id}')" title="Imprimir Factura" style="padding: 0.25rem 0.5rem; min-width: auto;">
                  <i class="ri-printer-line"></i>
                </button>
             </div>
          </div>
          <h4 style="margin: 0 0 0.25rem 0;">${order.customer_name}</h4>
          <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;"><i class="ri-phone-line"></i> ${order.customer_phone}</p>
          <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--color-primary);">$${parseFloat(order.total_amount).toLocaleString()}</div>
          
          <div style="display: flex; gap: 0.5rem; border-top: 1px solid #f3f4f6; padding-top: 0.75rem;">
            <button class="btn-secondary-small" style="flex: 1; justify-content: center; align-items: center;" onclick="window.viewOrderDetails('${order.id}')">Ver Detalle</button>
            ${order.status === 'pending' ?
          `<button class="btn-primary-small" style="flex: 1; justify-content: center; align-items: center;" onclick="window.verifyOrder('${order.id}')">Verificar</button>
             <button class="btn-secondary-small danger" style="flex: 0 0 36px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="window.cancelOrder('${order.id}')" title="Cancelar">
                <i class="ri-close-line"></i>
             </button>` : ''
        }
            ${order.status === 'verified' ?
          `<button class="btn-primary-small" style="flex: 1; background: #7e22ce; justify-content: center; align-items: center;" onclick="window.openAssignOrderModal('${order.id}', '${order.id.slice(0, 8)}')">Despachar</button>
             <button class="btn-secondary-small danger" style="flex: 0 0 36px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="window.cancelOrder('${order.id}')" title="Cancelar">
                <i class="ri-close-line"></i>
             </button>` : ''
        }
            ${order.status === 'dispatched' ?
          `<button class="btn-primary-small" style="flex: 1; background: #2563eb; justify-content: center; align-items: center;" onclick="window.completeOrder('${order.id}')">Completar</button>
             <button class="btn-secondary-small danger" style="flex: 0 0 36px; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="window.cancelOrder('${order.id}')" title="Cancelar">
                <i class="ri-close-line"></i>
             </button>` : ''
        }
          </div>
        </div>
      `).join('')
    }
  }
}

function getOrderStatusBadge(status) {
  const styles = {
    pending: { bg: '#fff7ed', color: '#c2410c', text: 'Pendiente', icon: 'ri-time-line' },
    verified: { bg: '#f0fdf4', color: '#15803d', text: 'Verificado', icon: 'ri-check-double-line' },
    dispatched: { bg: '#f3e8ff', color: '#7e22ce', text: 'Despachado', icon: 'ri-motorbike-fill' },
    completed: { bg: '#eff6ff', color: '#1d4ed8', text: 'Completado', icon: 'ri-flag-line' },
    cancelled: { bg: '#fef2f2', color: '#b91c1c', text: 'Cancelado', icon: 'ri-close-circle-line' }
  }
  const s = styles[status] || styles.pending
  return `<span style="background: ${s.bg}; color: ${s.color}; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
    <i class="${s.icon}"></i> ${s.text}
  </span>`
}

// Global actions for onclick
window.viewOrderDetails = async (orderId) => {
  try {
    const modal = document.getElementById('orderDetailsModal')
    const content = document.getElementById('orderDetailsContent')
    const verifyBtn = document.getElementById('verifyOrderBtn')

    if (!modal || !content) return

    content.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 200px;"><div class="loading-spinner-ring" style="position: relative !important; top: auto !important; left: auto !important; margin: 0 auto; width: 40px; height: 40px; border-width: 4px;"></div></div>'
    modal.style.display = 'flex'

    const orderData = await ordersService.getOrderDetails(orderId)

    // Render Modal Content
    // Render Modal Content
    const itemsHtml = orderData.items.map(item => {
      let optionsHtml = ''

      // 1. Grupos de Opciones (Nuevo sistema)
      if (item.options?.groups && item.options.groups.length > 0) {
        optionsHtml += item.options.groups.map(group => {
          // Formatear selecciones: Nombre (+$Precio)
          const selections = group.selections.map(s => {
            return parseFloat(s.price) > 0 ? `${s.name} (+$${parseFloat(s.price).toLocaleString()})` : s.name
          }).join(', ')
          return `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;"><strong>${group.name}:</strong> ${selections}</div>`
        }).join('')
      }

      // 2. Comentarios Rápidos (Múltiples - Nuevo)
      if (item.options?.quickComments && item.options.quickComments.length > 0) {
        optionsHtml += item.options.quickComments.map(c =>
          `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">Nota: ${c.name}</div>`
        ).join('')
      }
      // Fallback: Comentario Rápido Único (Legacy)
      else if (item.options?.quickComment) {
        optionsHtml += `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">Nota: ${item.options.quickComment.name}</div>`
      }

      // 3. Acompañantes (Legacy)
      if (item.options?.sides && item.options.sides.length > 0) {
        optionsHtml += `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 2px;">+ ${item.options.sides.map(s => s.name).join(', ')}</div>`
      }

      return `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding: 0.5rem 0;">
        <div>
          <div style="font-weight: 500;">${item.quantity}x ${item.product_name}</div>
          ${item.options?.size ? `<div style="font-size: 0.8rem; color: #6b7280;">Tamaño: ${item.options.size.name}</div>` : ''}
          ${optionsHtml}
        </div>
        <div style="font-weight: 600;">$${parseFloat(item.total_price).toLocaleString()}</div>
      </div>
    `}).join('')

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
         <div>
            <label style="font-size: 0.8rem; color: #6b7280; display: block;">Cliente</label>
            <div style="font-weight: 600;">${orderData.customer_name}</div>
            <div>${orderData.customer_phone}</div>
            <button class="btn-secondary-small" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;" onclick="window.printOrderInvoice('${orderId}')">
                <i class="ri-printer-line"></i> Imprimir Factura
            </button>
         </div>
         <div>
            <label style="font-size: 0.8rem; color: #6b7280; display: block;">Estado</label>
            <div>${getOrderStatusBadge(orderData.status)}</div>
         </div>
         <div style="grid-column: 1 / -1;">
            <label style="font-size: 0.8rem; color: #6b7280; display: block;">Dirección de Entrega</label>
            <div>${orderData.customer_address}</div>
            <div style="font-size: 0.9rem; color: #6b7280;">${orderData.customer_neighborhood || ''}</div>
         </div>
         ${orderData.order_notes ? `
         <div style="grid-column: 1 / -1; background: #fffbeb; padding: 0.75rem; border-radius: 6px;">
            <label style="font-size: 0.8rem; color: #92400e; display: block; font-weight: 600;">Observaciones:</label>
            <div style="color: #92400e;">${orderData.order_notes}</div>
         </div>` : ''}
      </div>

      <h4 style="border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5rem; margin-bottom: 1rem;">Productos</h4>
      <div style="margin-bottom: 1.5rem;">
        ${itemsHtml}
      </div>
      
      <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
         <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Subtotal</span>
            <span>$${(parseFloat(orderData.total_amount) - parseFloat(orderData.delivery_price)).toLocaleString()}</span>
         </div>
         <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Domicilio</span>
            <span>$${parseFloat(orderData.delivery_price).toLocaleString()}</span>
         </div>
         <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;">
            <span>Total</span>
            <span style="color: var(--color-primary);">$${parseFloat(orderData.total_amount).toLocaleString()}</span>
         </div>
         <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280; text-align: right;">
            Método de Pago: <strong>${orderData.payment_method}</strong>
         </div>
      </div>
    `

    // Setup action actions
    if (orderData.status === 'pending') {
      content.innerHTML += `
        <div style="display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
          <button class="btn-secondary danger" style="flex: 1;" onclick="window.cancelOrder('${orderId}'); document.getElementById('orderDetailsModal').style.display='none'">Cancelar Pedido</button>
          <button id="verifyOrderBtn" class="btn-primary" style="flex: 1;" onclick="window.verifyOrder('${orderId}'); document.getElementById('orderDetailsModal').style.display='none'">Verificar Pedido</button>
        </div>
      `
    } else if (orderData.status === 'verified') {
      content.innerHTML += `
         <div style="display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
            <button class="btn-secondary danger" style="flex: 1;" onclick="window.cancelOrder('${orderId}'); document.getElementById('orderDetailsModal').style.display='none'">Cancelar Pedido</button>
            <button class="btn-primary" style="flex: 1; background: #7e22ce;" onclick="window.openAssignOrderModal('${orderId}', '${orderId.slice(0, 8)}'); document.getElementById('orderDetailsModal').style.display='none'">
              <i class="ri-motorbike-fill"></i> Despachar
            </button>
         </div>
      `
    } else if (orderData.status === 'dispatched') {
      content.innerHTML += `
         <div style="display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
            <button class="btn-secondary danger" style="flex: 1;" onclick="window.cancelOrder('${orderId}'); document.getElementById('orderDetailsModal').style.display='none'">Cancelar Pedido</button>
            <button class="btn-primary" style="flex: 1; background: #2563eb;" onclick="window.completeOrder('${orderId}'); document.getElementById('orderDetailsModal').style.display='none'">
              <i class="ri-flag-line"></i> Completar
            </button>
         </div>
      `
    }

    // Common Action: Internal Notes
    // Add this after status-specific actions or as a separate block
    // We add it to content regardless of status (unless cancelled?)
    if (orderData.status !== 'cancelled') {
      const notesSection = document.createElement('div')
      notesSection.style.marginTop = '1.5rem'
      notesSection.style.paddingTop = '1rem'
      notesSection.style.borderTop = '1px dashed #e5e7eb'
      notesSection.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="font-size: 0.9rem; color: #374151; display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                    <i class="ri-sticky-note-line"></i> Notas Internas (Privado)
                </h4>
                <button class="btn-secondary-small" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="window.editInternalNotes('${orderId}')">
                    <i class="ri-edit-line"></i> ${orderData.internal_notes ? 'Editar' : 'Agregar'}
                </button>
            </div>
            <div id="internalNotesDisplay-${orderId}" style="background: #eff6ff; padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; color: #1e40af; min-height: 40px;">
                ${orderData.internal_notes || '<span style="color: #94a3b8; font-style: italic;">Sin notas internas...</span>'}
            </div>
        `
      content.appendChild(notesSection)
    }

    // Add Delete/Cancel Button at the bottom for all orders
    const deleteSection = document.createElement('div')
    deleteSection.style.marginTop = '2rem'
    deleteSection.style.paddingTop = '1rem'
    deleteSection.style.borderTop = '1px solid #f3f4f6'

    // Use a container for better spacing if needed, fitting the "SaaS look"
    deleteSection.innerHTML = `
        <button class="btn-secondary danger" style="width: 100%; justify-content: center; padding: 0.75rem;" onclick="window.deleteOrder('${orderId}', true)">
            <i class="ri-delete-bin-line"></i> Eliminar Pedido del Historial
        </button>
        <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #9ca3af; text-align: center;">
            Esta acción elimina el registro permanentemente.
        </p>
    `
    content.appendChild(deleteSection)

  } catch (error) {
    console.error('Error details:', error)
    notify.error('Error al cargar detalles')
    if (modal) modal.style.display = 'none'
  }
}

window.editInternalNotes = async (orderId) => {
  // Find order in local state to get current note
  const order = orders.find(o => o.id === orderId)
  if (!order) return

  const currentText = order.internal_notes || ''

  const existingModal = document.getElementById('noteModal')
  if (existingModal) existingModal.remove()

  const modal = document.createElement('div')
  modal.id = 'noteModal'
  modal.className = 'confirm-modal' // Reuse confirm modal styles
  modal.style.zIndex = '9999' // Above details modal
  modal.innerHTML = `
        <div class="confirm-overlay"></div>
        <div class="confirm-content" style="width: 100%; max-width: 400px;">
            <h3 class="confirm-title" style="margin-bottom: 1rem;">Notas Internas</h3>
            <textarea id="noteInput" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; min-height: 100px; font-family: inherit; margin-bottom: 1rem; resize: vertical;" placeholder="Escribe aquí observaciones privadas del pedido...">${currentText}</textarea>
            <div class="confirm-actions">
                <button class="btn-confirm-cancel" id="cancelNote">Cancelar</button>
                <button class="btn-confirm-ok" id="saveNote">Guardar Nota</button>
            </div>
        </div>
    `
  document.body.appendChild(modal)

  // Animation
  modal.style.display = 'flex'
  setTimeout(() => modal.classList.add('confirm-show'), 10)

  const textarea = modal.querySelector('#noteInput')
  textarea.focus()

  // Handlers
  const close = () => {
    modal.classList.remove('confirm-show')
    setTimeout(() => modal.remove(), 200)
  }

  modal.querySelector('.confirm-overlay').onclick = close
  modal.querySelector('#cancelNote').onclick = close

  modal.querySelector('#saveNote').onclick = async () => {
    const newNote = textarea.value.trim()
    const saveBtn = modal.querySelector('#saveNote')

    try {
      saveBtn.textContent = 'Guardando...'
      saveBtn.disabled = true

      await ordersService.updateInternalNotes(orderId, newNote)

      // Update local state
      order.internal_notes = newNote

      // Update UI in Details Modal if open
      const displayEl = document.getElementById(`internalNotesDisplay-${orderId}`)
      if (displayEl) {
        displayEl.innerHTML = newNote || '<span style="color: #94a3b8; font-style: italic;">Sin notas internas...</span>'
      }

      // Re-render table to update button style
      renderOrders()

      notify.success('Nota guardada')
      close()
    } catch (error) {
      console.error(error)
      notify.error('Error al guardar nota')
      saveBtn.textContent = 'Guardar Nota'
      saveBtn.disabled = false
    }
  }
}

window.dispatchOrder = async (orderId) => {
  const confirmed = await confirm.show({
    title: '¿Despachar pedido?',
    message: 'El pedido pasará a estado despachado (en camino).',
    type: 'info',
    confirmText: 'Despachar'
  })
  if (!confirmed) return

  const loadingToast = notify.loading('Despachando pedido...')
  try {
    const { error } = await ordersService.updateStatus(orderId, 'dispatched')
    if (error) throw error

    notify.updateLoading(loadingToast, 'Pedido despachado correctamente', 'success')
    loadOrders()
  } catch (error) {
    console.error('Error dispatching order:', error)
    notify.updateLoading(loadingToast, 'Error al despachar el pedido', 'error')
  }
}

window.verifyOrder = async (orderId) => {
  const confirmed = await confirm.show({
    title: '¿Verificar pedido?',
    message: 'El pedido pasará a estado verificado y se notificará al cliente.',
    type: 'success',
    confirmText: 'Verificar'
  })
  if (!confirmed) return

  const loadingToast = notify.loading('Verificando pedido...')
  try {
    const { error } = await ordersService.updateStatus(orderId, 'verified')
    if (error) throw error

    notify.updateLoading(loadingToast, 'Pedido verificado correctamente', 'success')
    updateOrdersBadgeCount()
    loadOrders()
  } catch (error) {
    console.error('Error verifying order:', error)
    notify.updateLoading(loadingToast, 'Error al verificar el pedido', 'error')
  }
}


window.completeOrder = async (orderId) => {
  const confirmed = await confirm.show({
    title: '¿Completar pedido?',
    message: 'El pedido se marcará como entregado y finalizado.',
    type: 'info',
    confirmText: 'Completar'
  })
  if (!confirmed) return

  const loadingToast = notify.loading('Completando pedido...')
  try {
    const { error } = await ordersService.updateStatus(orderId, 'completed')
    if (error) throw error

    notify.updateLoading(loadingToast, 'Pedido completado exitosamente', 'success')
    loadOrders()
  } catch (error) {
    console.error('Error completing order:', error)
    notify.updateLoading(loadingToast, 'Error al completar el pedido', 'error')
  }
}

window.cancelOrder = async (orderId) => {
  const confirmed = await confirm.show({
    title: '¿Cancelar pedido?',
    message: 'El pedido será cancelado. Esta acción no se puede deshacer.',
    type: 'danger',
    confirmText: 'Cancelar'
  })
  if (!confirmed) return

  const loadingToast = notify.loading('Cancelando pedido...')
  try {
    const { error } = await ordersService.updateStatus(orderId, 'cancelled')
    if (error) throw error

    notify.updateLoading(loadingToast, 'Pedido cancelado', 'success')
    loadOrders()
  } catch (error) {
    console.error('Error cancelling order:', error)
    notify.updateLoading(loadingToast, 'Error al cancelar el pedido', 'error')
  }
}

window.deleteOrder = async (orderId, fromModal = false) => {
  const confirmed = await confirm.show({
    title: '¿Eliminar pedido?',
    message: 'Este pedido será eliminado permanentemente. Esta acción no se puede deshacer.',
    type: 'danger',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar'
  })
  if (!confirmed) return

  const loadingToast = notify.loading('Eliminando pedido...')
  try {
    await ordersService.deleteOrder(orderId)
    notify.updateLoading(loadingToast, 'Pedido eliminado', 'success')
    orders = orders.filter(o => o.id !== orderId)
    renderOrders()
    if (fromModal) {
      document.getElementById('orderDetailsModal').style.display = 'none'
    }
  } catch (error) {
    console.error(error)
    notify.updateLoading(loadingToast, 'Error al eliminar pedido', 'error')
  }
}

window.printOrderInvoice = async (orderId) => {
  // Determine source of order data
  let order = orders.find(o => o.id === orderId)

  // If we have detailed data (e.g. from modal fetch), ideally we use that, 
  // but the generator might need full item details which might not be in the list view object if it's simplified.
  // However, usually 'orders' list has items. 
  // If not, we fetch it.

  const loadingToast = notify.loading('Generando factura...')
  try {
    // Fetch full details to ensure we have everything (items, options, etc)
    const fullOrder = await ordersService.getOrderDetails(orderId)

    // Pass currentBusiness (global variable)
    await generateOrderInvoice(fullOrder, currentBusiness)

    notify.updateLoading(loadingToast, 'Factura generada', 'success')
  } catch (error) {
    console.error('Invoice error:', error)
    notify.updateLoading(loadingToast, 'Error al generar factura', 'error')
  }
}

// Hook into sidebar nav to load orders
document.querySelectorAll('.nav-item[data-section="orders"]').forEach(link => {
  link.addEventListener('click', () => {
    loadOrders()
  })
})

// ============================================
// ORDERS LIMIT WARNING FOR BUSINESS OWNER
// ============================================
async function checkAndShowOrdersLimitWarning() {
  if (!currentBusiness) return

  try {
    const limitCheck = await businessService.canCreateOrder(currentBusiness.id)

    // Only show warning if limit is reached (not allowed) and it's a Plus plan
    if (!limitCheck.allowed && limitCheck.limit && limitCheck.limit !== Infinity) {
      showOwnerOrdersLimitModal()
    }
  } catch (error) {
    console.error('Error checking orders limit:', error)
  }
}

function showOwnerOrdersLimitModal() {
  // Check if modal already exists
  const existingModal = document.getElementById('ownerOrdersLimitModal')
  if (existingModal) {
    existingModal.remove()
  }

  const modal = document.createElement('div')
  modal.id = 'ownerOrdersLimitModal'
  modal.className = 'confirm-modal'
  modal.innerHTML = `
        < div class="confirm-overlay" ></div >
          <div class="confirm-content">
            <div class="confirm-icon confirm-icon-warning">
              <i class="ri-error-warning-line"></i>
            </div>
            <h3 class="confirm-title">Límite de Pedidos Alcanzado</h3>
            <p class="confirm-message">
              Has alcanzado el límite de <strong>300 pedidos mensuales</strong> de tu plan Plus.
              <br><br>
                No podrás recibir más pedidos hasta que actualices a <strong>Plan Pro</strong> con pedidos ilimitados.
              </p>
                <div class="confirm-actions">
                  <button class="btn-confirm-cancel" id="dismissOwnerLimit">
                    Entendido
                  </button>
                  <button class="btn-confirm-ok btn-confirm-warning" id="upgradeToProBtn">
                    <i class="ri-vip-crown-line"></i> Actualizar a PRO
                  </button>
                </div>
              </div>
              `

  document.body.appendChild(modal)
  modal.style.display = 'flex'

  // Animar entrada
  setTimeout(() => {
    modal.classList.add('confirm-show')
  }, 10)

  // Event listeners
  const dismissBtn = modal.querySelector('#dismissOwnerLimit')
  const upgradeBtn = modal.querySelector('#upgradeToProBtn')
  const overlay = modal.querySelector('.confirm-overlay')

  const closeModal = () => {
    modal.classList.remove('confirm-show')
    setTimeout(() => {
      modal.remove()
    }, 200)
  }

  dismissBtn.addEventListener('click', closeModal)
  overlay.addEventListener('click', closeModal)

  upgradeBtn.addEventListener('click', () => {
    closeModal()
    // Open upgrade modal or contact WhatsApp
    const upgradePlanModal = document.getElementById('upgradePlanModal')
    if (upgradePlanModal) {
      upgradePlanModal.style.display = 'flex'
    } else {
      // Fallback: Contact via WhatsApp
      const CONTACT_PHONE = '573180779665' // Replace with actual admin number
      const text = `Hola, quiero mejorar mi plan a PRO para el negocio: ${currentBusiness.name}`
      window.open(`https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(text)}`, '_blank')
    }
  })
}

// ============================================
// GLOBAL REALTIME INITIALIZATION
// ============================================
// Initialize realtime subscriptions as soon as dashboard loads with business data
// This ensures notifications work even when not on orders section

function tryInitRealtime() {
  if (currentBusiness) {
    initRealtimeOrders()
    updateOrdersBadgeCount()
  } else {
    setTimeout(tryInitRealtime, 500)
  }
}

// Start trying to initialize after a short delay
setTimeout(tryInitRealtime, 1000)

// ============================================
// OPERATIONAL REQUIREMENTS CHECK
// ============================================
function checkOperationalRequirements() {
  const alert = document.getElementById('operationalAlert')
  const alertText = document.getElementById('operationalAlertText')
  const alertBtn = document.getElementById('operationalAlertBtn')

  if (!alert) return

  const missing = []

  if (!paymentMethods || paymentMethods.length === 0) {
    missing.push('Métodos de Pago')
  }

  if (!businessHours || businessHours.length === 0) {
    missing.push('Horarios de Atención')
  }

  if (missing.length > 0) {
    alert.style.display = 'flex'
    // Join with ' y ' if 2 items, otherwise comma separated (though max 2 here)
    alertText.textContent = `Debes configurar: ${missing.join(' y ')} para recibir pedidos.`

    // Setup button click
    if (alertBtn) {
      alertBtn.onclick = () => {
        switchSection('business')
        // Try to visually highlight or scroll to settings
        // Since settings are in 'Mi Negocio', finding the settings grid is key
        setTimeout(() => {
          const settingsGrid = document.querySelector('.business-settings-grid')
          if (settingsGrid) {
            settingsGrid.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
    }
  } else {
    alert.style.display = 'none'
  }
}

// ============================================
// GESTIÓN DE DOMICILIARIOS
// ============================================
function initDeliveryPersons() {
  // Search & Filter
  const searchInput = document.getElementById('searchDeliveryInput')
  const filterPills = document.querySelectorAll('#filterVehiclePills .filter-pill')
  const addBtn = document.getElementById('addDeliveryPersonBtn')

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase()
      const activePill = document.querySelector('#filterVehiclePills .filter-pill.active')
      const currentType = activePill ? activePill.dataset.vehicle : 'all'
      filterDeliveryPersons(term, currentType)
    })
  }

  if (filterPills.length > 0) {
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        // Update active state
        filterPills.forEach(p => p.classList.remove('active'))
        pill.classList.add('active')

        // Filter
        const type = pill.dataset.vehicle
        const term = searchInput ? searchInput.value.toLowerCase() : ''
        filterDeliveryPersons(term, type)
      })
    })
  }

  // Create Modal
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openDeliveryPersonModal()
    })
  }

  // Modal Buttons
  const closeBtn = document.getElementById('closeDeliveryPersonModal')
  const cancelBtn = document.getElementById('cancelDeliveryPersonBtn')
  const saveBtn = document.getElementById('saveDeliveryPersonBtn')
  const form = document.getElementById('deliveryPersonForm')

  if (closeBtn) closeBtn.addEventListener('click', closeDeliveryPersonModal)
  if (cancelBtn) cancelBtn.addEventListener('click', closeDeliveryPersonModal)

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      await saveDeliveryPerson()
    })
  }

  // Detail Modal
  const closeDetailBtn = document.getElementById('closeDeliveryDetailModal')
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      document.getElementById('deliveryDetailModal').style.display = 'none'
    })
  }

  // Assign Modal
  const closeAssignBtn = document.getElementById('closeAssignOrderModal')
  const cancelAssignBtn = document.getElementById('cancelAssignBtn')
  const confirmAssignBtn = document.getElementById('confirmAssignBtn')

  if (closeAssignBtn) closeAssignBtn.addEventListener('click', closeAssignOrderModal)
  if (cancelAssignBtn) cancelAssignBtn.addEventListener('click', closeAssignOrderModal)

  if (confirmAssignBtn) {
    confirmAssignBtn.addEventListener('click', confirmOrderAssignment)
  }

  // Assign Search
  const searchAssignInput = document.getElementById('searchAssignInput')
  if (searchAssignInput) {
    searchAssignInput.addEventListener('input', (e) => {
      filterAssignmentList(e.target.value)
    })
  }
}

async function loadDeliveryPersons() {
  try {
    if (!currentBusiness) return

    // Show loader if needed
    const data = await deliveryPersonsService.getAll(currentBusiness.id)
    deliveryPersons = data || []

    // Reset UI Filters
    const filterPills = document.querySelectorAll('#filterVehiclePills .filter-pill')
    filterPills.forEach(p => p.classList.remove('active'))
    const allPill = document.querySelector('#filterVehiclePills .filter-pill[data-vehicle="all"]')
    if (allPill) allPill.classList.add('active')

    const searchInput = document.getElementById('searchDeliveryInput')
    if (searchInput) searchInput.value = ''

    // Initial Render
    filterDeliveryPersons('', 'all')
  } catch (error) {
    console.error('Error loading delivery persons:', error)
    notify.error('Error al cargar domiciliarios')
  }
}

function filterDeliveryPersons(searchTerm, vehicleType) {
  let filtered = deliveryPersons

  if (searchTerm) {
    filtered = filtered.filter(dp =>
      dp.name.toLowerCase().includes(searchTerm) ||
      dp.unique_code.toLowerCase().includes(searchTerm)
    )
  }

  if (vehicleType && vehicleType !== 'all') {
    filtered = filtered.filter(dp => dp.vehicle_type === vehicleType)
  }

  renderDeliveryPersonsTable(filtered)
}

function renderDeliveryPersonsTable(list) {
  const tbody = document.getElementById('deliveryPersonsTableBody')
  const emptyState = document.getElementById('noDeliveryPersonsState')
  const tableContainer = document.querySelector('#section-delivery-persons .table-container')

  if (!tbody) return

  tbody.innerHTML = ''

  if (list.length === 0) {
    if (deliveryPersons.length === 0) {
      // No deliveries at all
      tableContainer.style.display = 'none'
      emptyState.style.display = 'flex'
    } else {
      // Filter result empty
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No se encontraron resultados</td></tr>`
      tableContainer.style.display = 'block'
      emptyState.style.display = 'none'
    }
  } else {
    tableContainer.style.display = 'block'
    emptyState.style.display = 'none'

    list.forEach(dp => {
      const tr = document.createElement('tr')

      const statusClass = dp.is_active ? 'active' : 'inactive'
      const statusText = dp.is_active ? 'Activo' : 'Inactivo'

      tr.innerHTML = `
        <td><span class="delivery-code">${dp.unique_code}</span></td>
        <td><strong>${dp.name}</strong></td>
        <td><span class="badge-vehicle ${dp.vehicle_type}">${dp.vehicle_type.replace('_', ' ')}</span></td>
        <td><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td>${dp.total_deliveries || 0}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="viewDeliveryDetail('${dp.id}')" title="Ver detalles">
              <i class="ri-eye-line"></i>
            </button>
            <button class="btn-icon" onclick="editDeliveryPerson('${dp.id}')" title="Editar">
              <i class="ri-pencil-line"></i>
            </button>
            <button class="btn-icon danger" onclick="deleteDeliveryPerson('${dp.id}')" title="Eliminar">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </td>
      `
      tbody.appendChild(tr)
    })
  }
}

// Global functions for inline onclick handlers
window.viewDeliveryDetail = async (id) => {
  try {
    const person = deliveryPersons.find(p => p.id === id)
    if (!person) return

    // Load extra history
    const history = await deliveryPersonsService.getHistory(id)

    document.getElementById('detailName').textContent = person.name
    document.getElementById('detailCode').textContent = person.unique_code

    const vSpan = document.getElementById('detailVehicle')
    vSpan.className = `badge-vehicle ${person.vehicle_type}`
    vSpan.textContent = person.vehicle_type.replace('_', ' ')

    const sSpan = document.getElementById('detailStatus')
    sSpan.className = `badge-status ${person.is_active ? 'active' : 'inactive'}`
    sSpan.textContent = person.is_active ? 'Activo' : 'Inactivo'

    document.getElementById('detailTotalDeliveries').textContent = person.total_deliveries || 0
    document.getElementById('detailJoinedDate').textContent = new Date(person.created_at).toLocaleDateString()

    // Render Recent History
    const hBody = document.getElementById('detailRecentHistory')
    hBody.innerHTML = ''

    if (!history || history.length === 0) {
      hBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Sin pedidos recientes</td></tr>`
    } else {
      history.forEach(h => {
        const row = document.createElement('tr')
        row.innerHTML = `
                <td>${new Date(h.assigned_at || h.created_at).toLocaleDateString()}</td>
                <td>#${h.id.slice(0, 8)}</td>
                <td>${h.customer_name}</td>
                <td>$${parseFloat(h.total_amount).toLocaleString()}</td>
                <td><span class="status-badge status-${h.status}">${getTranslatedStatus(h.status)}</span></td>
            `
        hBody.appendChild(row)
      })
    }

    document.getElementById('deliveryDetailModal').style.display = 'flex'
  } catch (error) {
    console.error(error)
    notify.error('Error al cargar detalles')
  }
}

window.editDeliveryPerson = (id) => {
  const person = deliveryPersons.find(p => p.id === id)
  if (person) {
    openDeliveryPersonModal(person)
  }
}

window.deleteDeliveryPerson = async (id) => {
  const confirmed = await confirm.show({
    title: 'Eliminar domiciliario',
    message: '¿Estás seguro? Esta acción no se puede deshacer. Solo se puede eliminar si no tiene pedidos activos.',
    confirmText: 'Sí, eliminar',
    type: 'danger'
  })

  if (confirmed) {
    try {
      await deliveryPersonsService.delete(id)
      notify.success('Domiciliario eliminado')
      loadDeliveryPersons()
    } catch (error) {
      notify.error(error.message || 'Error al eliminar')
    }
  }
}

// Modal Logic
function openDeliveryPersonModal(person = null) {
  const modal = document.getElementById('deliveryPersonModal')
  const title = document.getElementById('deliveryPersonModalTitle')
  const form = document.getElementById('deliveryPersonForm')

  // Groups
  const codeGroup = document.getElementById('codeGroup')

  // Fields
  const idInput = document.getElementById('deliveryPersonId')
  const codeInput = document.getElementById('deliveryPersonCode')
  const nameInput = document.getElementById('deliveryPersonName')
  const activeCheck = document.getElementById('deliveryPersonActive')
  const vehicleSelect = document.getElementById('deliveryPersonVehicle')

  if (person) {
    title.textContent = 'Editar Domiciliario'
    editingDeliveryPerson = person
    idInput.value = person.id
    codeGroup.style.display = 'block'
    codeInput.value = person.unique_code
    nameInput.value = person.name
    activeCheck.checked = person.is_active
    vehicleSelect.value = person.vehicle_type
  } else {
    title.textContent = 'Nuevo Domiciliario'
    editingDeliveryPerson = null
    idInput.value = ''
    form.reset()
    codeGroup.style.display = 'none' // Hidden on create (will be generated)
    activeCheck.checked = true
    vehicleSelect.value = 'moto' // Default
  }

  modal.style.display = 'flex'
}

function closeDeliveryPersonModal() {
  document.getElementById('deliveryPersonModal').style.display = 'none'
  editingDeliveryPerson = null
}

async function saveDeliveryPerson() {
  const saveBtn = document.getElementById('saveDeliveryPersonBtn')

  try {
    await buttonLoader.execute(saveBtn, async () => {
      const name = document.getElementById('deliveryPersonName').value
      const isActive = document.getElementById('deliveryPersonActive').checked
      const vehicleType = document.getElementById('deliveryPersonVehicle').value

      const data = {
        business_id: currentBusiness.id,
        name,
        vehicle_type: vehicleType,
        is_active: isActive
      }

      if (editingDeliveryPerson) {
        // Update
        await deliveryPersonsService.update(editingDeliveryPerson.id, data)
        notify.success('Domiciliario actualizado')
      } else {
        // Create
        await deliveryPersonsService.create(data)
        notify.success('Domiciliario creado exitosamente')
      }

      closeDeliveryPersonModal()
      loadDeliveryPersons()
    }, 'Guardando...')
  } catch (error) {
    console.error(error)
    notify.error('Error al guardar')
  }
}

// ORDER ASSIGNMENT LOGIC

let orderToAssignId = null
let selectedDeliveryPersonId = null

// Called from Orders Table (Need to update renderOrdersTable separately)
window.openAssignOrderModal = async (orderId, orderNumber) => {
  orderToAssignId = orderId
  selectedDeliveryPersonId = null

  const modal = document.getElementById('assignOrderModal')
  document.getElementById('assignOrderNumber').textContent = `#${orderNumber}`

  // Ensure we have the latest list
  if (deliveryPersons.length === 0 || !deliveryPersons) {
    try {
      const data = await deliveryPersonsService.getAll(currentBusiness.id)
      deliveryPersons = data || []
    } catch (e) {
      console.error(e)
    }
  }

  renderAssignmentList(deliveryPersons)

  modal.style.display = 'flex'
}

function renderAssignmentList(list) {
  const listContainer = document.getElementById('assignmentList')
  listContainer.innerHTML = ''

  // "Unassigned" option
  const nullDiv = document.createElement('div')
  nullDiv.className = 'assignment-option'
  nullDiv.onclick = () => selectAssignmentOption(null, nullDiv)
  nullDiv.innerHTML = `
        <div class="assignment-info">
            <h4>Sin asignar</h4>
            <p>Despachar sin domiciliario específico</p>
        </div>
        <i class="ri-user-unfollow-line"></i>
    `
  listContainer.appendChild(nullDiv)

  // Filter active persons
  const activeList = list.filter(p => p.is_active)

  activeList.forEach(p => {
    const div = document.createElement('div')
    div.className = 'assignment-option'
    div.onclick = () => selectAssignmentOption(p.id, div)
    div.innerHTML = `
             <div class="assignment-info">
                <h4>${p.name}</h4>
                <p><strong>${p.unique_code}</strong> • ${p.vehicle_type.replace('_', ' ')}</p>
            </div>
            <i class="ri-motorbike-line"></i>
        `
    listContainer.appendChild(div)
  })
}

function selectAssignmentOption(id, element) {
  selectedDeliveryPersonId = id

  // Visual selection
  document.querySelectorAll('.assignment-option').forEach(el => el.classList.remove('selected'))
  element.classList.add('selected')
}

function filterAssignmentList(term) {
  const termLower = term.toLowerCase()

  // Always keep "null" option conceptually, but maybe filter active list
  const filtered = deliveryPersons.filter(p =>
    p.is_active && (
      p.name.toLowerCase().includes(termLower) ||
      p.unique_code.toLowerCase().includes(termLower)
    )
  )

  renderAssignmentList(filtered)
}

function closeAssignOrderModal() {
  document.getElementById('assignOrderModal').style.display = 'none'
  orderToAssignId = null
  selectedDeliveryPersonId = null
}

async function confirmOrderAssignment() {
  if (!orderToAssignId) return

  const confirmBtn = document.getElementById('confirmAssignBtn')

  try {
    await buttonLoader.execute(confirmBtn, async () => {
      await ordersService.assignDeliveryPerson(orderToAssignId, selectedDeliveryPersonId)

      notify.success('Pedido despachado correctamente')
      closeAssignOrderModal()
      loadOrders(ordersCurrentPage) // Refresh orders
    }, 'Procesando...')
  } catch (error) {
    console.error(error)
    notify.error('Error al despachar pedido')
  }
}

function getTranslatedStatus(status) {
  const map = {
    'pending': 'Pendiente',
    'verified': 'Verificado',
    'dispatched': 'Despachado',
    'completed': 'Completado',
    'cancelled': 'Cancelado'
  }
  return map[status] || status
}
