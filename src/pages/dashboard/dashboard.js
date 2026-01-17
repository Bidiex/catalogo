import { authService } from '../../services/auth.js'
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
import { promotionsService } from '../../services/promotions.js'
import { promotionOptionsService } from '../../services/promotionOptions.js'
import { imageService } from '../../services/images.js'
import { supportService } from '../../services/support.js'

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
      window.location.href = '/src/pages/login/index.html'
      return
    }

    currentUser = await authService.getCurrentUser()
    userEmailSpan.textContent = currentUser.email

    // Inicializar navegación del sidebar
    initSidebarNavigation()

    // Inicializar menú móvil
    initMobileMenu()

    // Inicializar soporte
    initSupport()

    // Cargar negocio
    await loadBusiness()

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

  // Inicializar editor de WhatsApp
  initWhatsAppEditor()
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
    'categories': 'Categorías',
    'products': 'Productos',
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
      await loadAllData()
      await loadWhatsAppTemplate() // ← AGREGAR ESTA LÍNEA
      showBusinessState()
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

    renderBusinessInfo()
    renderCategories()
    renderProducts()
    renderPaymentMethods()
    renderBusinessHours()
    loadSupportTickets() // Cargar tickets soporte
    updateDashboardStats()
  } catch (error) {
    console.error('Error loading data:', error)
    notify.error('Error al cargar los datos')
  }
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

  // Visitas al Catálogo (desde localStorage o backend)
  const statCatalogVisits = document.getElementById('statCatalogVisits')
  if (statCatalogVisits) {
    const visitsKey = `catalog_visits_${currentBusiness.id}`
    const visits = localStorage.getItem(visitsKey) || '0'
    statCatalogVisits.textContent = parseInt(visits).toLocaleString()
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
}

function showBusinessState() {
  loadingState.style.display = 'none'
  noBusinessState.style.display = 'none'
  businessExistsState.style.display = 'block'
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderBusinessInfo() {
  businessName.textContent = currentBusiness.name
  businessWhatsapp.textContent = currentBusiness.whatsapp_number

  // Update logo display
  const logoDisplay = document.getElementById('business-logo-display')
  if (logoDisplay) {
    if (currentBusiness.logo_url) {
      logoDisplay.innerHTML = `<img src="${currentBusiness.logo_url}" alt="Logo" style="object-fit:cover; width:100%; height:100%;">`
    } else {
      logoDisplay.innerHTML = `<i class="ri-store-2-line" style="font-size: 3rem; color: #9ca3af;"></i>`
    }
  }

  // Actualizar nombre en el sidebar
  const businessBranchName = document.getElementById('businessBranchName')
  if (businessBranchName) {
    businessBranchName.textContent = currentBusiness.name
  }

  const catalogUrl = `${window.location.origin}/src/pages/catalog/index.html?slug=${currentBusiness.slug}`
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
  <div class="product-card-actions">
    <button class="btn-manage-options manage-options" data-id="${product.id}">
    <i class="ri-settings-3-line"></i> Opciones
  </button>
  <button class="btn-icon" onclick="openDiscountModal('PRODUCT_ID')">
    <i class="ri-price-tag-line"></i> Descuentos
 </button>
  <button class="btn-icon edit-product" data-id="${product.id}">
    <i class="ri-edit-line"></i>
  </button>
  <button class="btn-icon danger delete-product" data-id="${product.id}">
    <i class="ri-delete-bin-line"></i>
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
  const descriptionInput = document.getElementById('businessDescriptionInput')

  if (isEdit && currentBusiness) {
    modalTitle.textContent = 'Editar Negocio'
    nameInput.value = currentBusiness.name
    slugInput.value = currentBusiness.slug
    slugInput.disabled = true // No permitir cambiar slug
    whatsappInput.value = currentBusiness.whatsapp_number
    descriptionInput.value = currentBusiness.description || ''
  } else {
    modalTitle.textContent = 'Crear Negocio'
    nameInput.value = ''
    slugInput.value = ''
    slugInput.disabled = false
    whatsappInput.value = ''
    descriptionInput.value = ''
  }

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

document.getElementById('businessForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = document.getElementById('businessNameInput').value
  const slug = document.getElementById('businessSlugInput').value
  const whatsapp = document.getElementById('businessWhatsappInput').value
  const description = document.getElementById('businessDescriptionInput').value

  const saveBtn = document.getElementById('saveBusinessBtn')

  await buttonLoader.execute(saveBtn, async () => {
    try {
      const businessData = { name, slug, whatsapp_number: whatsapp, description }

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
addProductBtn.addEventListener('click', () => openProductModal())

document.getElementById('closeProductModal').addEventListener('click', closeProductModal)
document.getElementById('cancelProductBtn').addEventListener('click', closeProductModal)

function openProductModal() {
  editingProduct = null
  document.getElementById('productModalTitle').textContent = 'Nuevo Producto'
  document.getElementById('productForm').reset()
  populateCategorySelect()
  resetProductImageUpload() // ← AGREGAR ESTA LÍNEA
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

  await authService.signOut()
  window.location.href = '/src/pages/login/index.html'
})

// ============================================
// PRODUCT OPTIONS MANAGEMENT
// ============================================

let currentProductForOptions = null
let quickComments = []
let sides = []
let editingOption = null
let editingOptionType = null

const productOptionsModal = document.getElementById('productOptionsModal')
const closeProductOptionsModal = document.getElementById('closeProductOptionsModal')
const closeProductOptionsBtn = document.getElementById('closeProductOptionsBtn')
const optionsProductName = document.getElementById('optionsProductName')
const quickCommentsListDashboard = document.getElementById('quickCommentsListDashboard')
const sidesListDashboard = document.getElementById('sidesListDashboard')
const addQuickCommentBtn = document.getElementById('addQuickCommentBtn')
const addSideBtn = document.getElementById('addSideBtn')

const optionModal = document.getElementById('optionModal')
const closeOptionModal = document.getElementById('closeOptionModal')
const cancelOptionBtn = document.getElementById('cancelOptionBtn')
const optionForm = document.getElementById('optionForm')
const optionModalTitle = document.getElementById('optionModalTitle')
const optionNameInput = document.getElementById('optionNameInput')
const optionPriceInput = document.getElementById('optionPriceInput')
const optionPriceGroup = document.getElementById('optionPriceGroup')

// Función para abrir modal de opciones
async function openProductOptionsModal(productId) {
  currentProductForOptions = products.find(p => p.id === productId)
  if (!currentProductForOptions) return

  // Fix: Clear promotion context to avoid mixing up options
  currentPromotionForOptions = null

  // Resetear estado
  quickComments = []
  sides = []

  optionsProductName.textContent = currentProductForOptions.name

  await loadProductOptions(productId)
  renderProductOptionsDashboard()

  productOptionsModal.style.display = 'flex'
}

async function loadProductOptions(productId) {
  try {
    const options = await productOptionsService.getByProduct(productId)
    quickComments = options.filter(opt => opt.type === 'quick_comment')
    sides = options.filter(opt => opt.type === 'side')
  } catch (error) {
    console.error('Error loading product options:', error)
    quickComments = []
    sides = []
  }
}

function renderProductOptionsDashboard() {
  // Renderizar comentarios rápidos
  if (quickComments.length === 0) {
    quickCommentsListDashboard.innerHTML = '<p class="empty-message" style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.9rem;">No hay comentarios rápidos</p>'
  } else {
    quickCommentsListDashboard.innerHTML = quickComments.map(comment => `
      <div class="option-item">
        <div class="option-item-info">
          <div class="option-item-name">${comment.name}</div>
        </div>
        <div class="option-item-actions">
          <button class="btn-icon-small edit-option" data-id="${comment.id}" data-type="quick_comment">Editar</button>
          <button class="btn-icon-small danger delete-option" data-id="${comment.id}">Eliminar</button>
        </div>
      </div>
    `).join('')

    attachOptionEventListeners()
  }

  // Renderizar acompañantes
  if (sides.length === 0) {
    sidesListDashboard.innerHTML = '<p class="empty-message" style="padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.9rem;">No hay acompañantes</p>'
  } else {
    sidesListDashboard.innerHTML = sides.map(side => `
      <div class="option-item">
        <div class="option-item-info">
          <div class="option-item-name">${side.name}</div>
          <div class="option-item-price">+$${parseFloat(side.price).toLocaleString()}</div>
        </div>
        <div class="option-item-actions">
          <button class="btn-icon-small edit-option" data-id="${side.id}" data-type="side">Editar</button>
          <button class="btn-icon-small danger delete-option" data-id="${side.id}">Eliminar</button>
        </div>
      </div>
    `).join('')

    attachOptionEventListeners()
  }
}

function attachOptionEventListeners() {
  document.querySelectorAll('.edit-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      const type = e.target.dataset.type
      openEditOptionModal(id, type)
    })
  })

  document.querySelectorAll('.delete-option').forEach(btn => {
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
})

closeProductOptionsBtn.addEventListener('click', () => {
  productOptionsModal.style.display = 'none'
  currentProductForOptions = null
})

// Abrir modal para agregar comentario rápido
addQuickCommentBtn.addEventListener('click', () => {
  openOptionModal('quick_comment')
})

// Abrir modal para agregar acompañante
addSideBtn.addEventListener('click', () => {
  openOptionModal('side')
})

function openOptionModal(type, optionId = null) {
  editingOptionType = type

  if (optionId) {
    // Editar
    const allOptions = [...quickComments, ...sides]
    editingOption = allOptions.find(opt => opt.id === optionId)

    optionModalTitle.textContent = type === 'quick_comment' ? 'Editar Comentario' : 'Editar Acompañante'
    optionNameInput.value = editingOption.name
    optionPriceInput.value = editingOption.price || 0
  } else {
    // Crear
    editingOption = null
    optionModalTitle.textContent = type === 'quick_comment' ? 'Nuevo Comentario Rápido' : 'Nuevo Acompañante'
    optionNameInput.value = ''
    optionPriceInput.value = 0
  }

  // Mostrar/ocultar campo de precio según el tipo
  if (type === 'quick_comment') {
    optionPriceGroup.style.display = 'none'
  } else {
    optionPriceGroup.style.display = 'flex'
  }

  optionModal.style.display = 'flex'
}

function openEditOptionModal(optionId, type) {
  openOptionModal(type, optionId)
}

function closeOptionModalFn() {
  optionModal.style.display = 'none'
  editingOption = null
  editingOptionType = null
  optionForm.reset()
}

closeOptionModal.addEventListener('click', closeOptionModalFn)
cancelOptionBtn.addEventListener('click', closeOptionModalFn)

// Guardar opción
optionForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = optionNameInput.value
  const price = (editingOptionType === 'side' || editingPromotionOptionType === 'side') ? parseFloat(optionPriceInput.value) : 0
  const submitBtn = e.submitter || document.querySelector('#optionForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      // Check if we're working with promotions or products
      if (currentPromotionForOptions) {
        // PROMOTION OPTIONS
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
        // PRODUCT OPTIONS
        const optionData = {
          product_id: currentProductForOptions.id,
          type: editingOptionType,
          name,
          price,
          display_order: editingOption ? editingOption.display_order : 0
        }

        if (editingOption) {
          await productOptionsService.update(editingOption.id, optionData)
          notify.success('Opción actualizada')
        } else {
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

// Instead of modifying switchSection, we can observe the change or just hook into the click event 
// found in initSidebarNavigation.

// Since we can't modify initSidebarNavigation easily without replacing huge chunk,
// Let's rely on the fact that existing logic handles `switchSection(section)`.
// We just need to ensure `loadPromotions` is called when that section is shown.
// We can modify `updatePageTitle` or similar hook if available, OR just add a dedicated listener.

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
    const description = document.getElementById('wiz-description').value.trim()

    const submitBtn = e.submitter

    await buttonLoader.execute(submitBtn, async () => {
      try {
        const slug = businessService.generateSlug(name)
        const businessData = {
          name,
          slug,
          whatsapp_number: whatsapp,
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

    await buttonLoader.run(saveDiscountBtn, async () => {
      try {
        const productId = discountProductId.value
        const percentage = parseFloat(discountPercentage.value)
        const startDate = discountStartDate.value
        const endDate = discountEndDate.value
        const isActive = discountActiveInput.checked

        // Validation
        if (!percentage || percentage <= 0 || percentage >= 100) {
          notify.error('El porcentaje debe estar entre 1 y 99')
          return
        }

        if (!startDate || !endDate) {
          notify.error('Debes ingresar ambas fechas (inicio y fin)')
          return
        }

        // Validate dates
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const start = new Date(startDate)
        const end = new Date(endDate)

        if (start < today) {
          notify.error('La fecha de inicio no puede ser anterior a hoy')
          return
        }

        if (end < start) {
          notify.error('La fecha fin no puede ser anterior a la fecha inicio')
          return
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
    const confirmed = await confirm('¿Estás seguro de eliminar este descuento?')
    if (!confirmed) return

    await buttonLoader.run(deleteDiscountBtn, async () => {
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
