import { authService } from '../../services/auth.js'
import { businessService } from '../../services/business.js'
import { categoryService } from '../../services/categories.js'
import { productService } from '../../services/products.js'
import { notify } from '../../utils/notifications.js'
import { confirm } from '../../utils/notifications.js'
import { buttonLoader } from '../../utils/buttonLoader.js'

// ============================================
// ESTADO GLOBAL
// ============================================
let currentUser = null
let currentBusiness = null
let categories = []
let products = []
let editingCategory = null
let editingProduct = null

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

const createBusinessBtn = document.getElementById('createBusinessBtn')
const editBusinessBtn = document.getElementById('editBusinessBtn')

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

    // Cargar negocio
    await loadBusiness()

  } catch (error) {
    console.error('Error initializing dashboard:', error)
    notify.error('Error al cargar el dashboard')
  }
}

async function loadBusiness() {
  try {
    currentBusiness = await businessService.getMyBusiness()

    if (!currentBusiness) {
      // No tiene negocio, mostrar pantalla de bienvenida
      showNoBusinessState()
    } else {
      // Tiene negocio, cargar datos
      await loadAllData()
      showBusinessState()
    }
  } catch (error) {
    console.error('Error loading business:', error)
    showNoBusinessState()
  }
}

async function loadAllData() {
  try {
    // Cargar categorías y productos en paralelo
    [categories, products] = await Promise.all([
      categoryService.getByBusiness(currentBusiness.id),
      productService.getByBusiness(currentBusiness.id)
    ])

    renderBusinessInfo()
    renderCategories()
    renderProducts()
  } catch (error) {
    console.error('Error loading data:', error)
    notify.error('Error al cargar los datos')
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

  const catalogUrl = `${window.location.origin}/src/pages/catalog/index.html?slug=${currentBusiness.slug}`
  catalogLink.href = catalogUrl
  catalogLink.textContent = catalogUrl
}

function renderCategories() {
  if (categories.length === 0) {
    categoriesList.innerHTML = '<p class="empty-message">No hay categorías aún</p>'
    return
  }

  categoriesList.innerHTML = categories.map(category => `
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
      const id = e.target.dataset.id
      openEditCategoryModal(id)
    })
  })

  document.querySelectorAll('.delete-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      deleteCategory(id)
    })
  })
}

function renderProducts() {
  if (products.length === 0) {
    productsList.innerHTML = '<p class="empty-message">No hay productos aún</p>'
    return
  }

  productsList.innerHTML = products.map(product => `
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
  <button class="btn-icon edit-product" data-id="${product.id}">
    <i class="ri-edit-line"></i> Editar
  </button>
  <button class="btn-manage-options manage-options" data-id="${product.id}">
    <i class="ri-settings-3-line"></i> Opciones
  </button>
  <button class="btn-icon danger delete-product" data-id="${product.id}">
    <i class="ri-delete-bin-line"></i> Eliminar
  </button>
</div>
      </div>
    </div>
  `).join('')

  // Event listeners
  document.querySelectorAll('.edit-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      openEditProductModal(id)
    })
  })

  document.querySelectorAll('.manage-options').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      openProductOptionsModal(id)
    })
  })

  document.querySelectorAll('.delete-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id
      deleteProduct(id)
    })
  })
}

// ============================================
// BUSINESS MODAL
// ============================================
createBusinessBtn.addEventListener('click', () => openBusinessModal())
editBusinessBtn.addEventListener('click', () => openBusinessModal(true))

document.getElementById('closeBusinessModal').addEventListener('click', closeBusinessModal)
document.getElementById('cancelBusinessBtn').addEventListener('click', closeBusinessModal)

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

    } catch (error) {
      console.error('Error saving category:', error)
      notify.error('Error al guardar la categoría')
    }
  }, 'Guardando...')
})

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
import { productOptionsService } from '../../services/productOptions.js'

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
  const product = products.find(p => p.id === productId)
  if (!product) return

  currentProductForOptions = product
  optionsProductName.textContent = product.name

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
  const price = editingOptionType === 'side' ? parseFloat(optionPriceInput.value) : 0
  const submitBtn = e.submitter || document.querySelector('#optionForm button[type="submit"]')

  await buttonLoader.execute(submitBtn, async () => {
    try {
      const optionData = {
        product_id: currentProductForOptions.id,
        type: editingOptionType,
        name,
        price,
        display_order: editingOption ? editingOption.display_order : 0
      }

      if (editingOption) {
        // Actualizar
        await productOptionsService.update(editingOption.id, optionData)
        notify.success('Opción actualizada')
      } else {
        // Crear
        await productOptionsService.create(optionData)
        notify.success('Opción creada')
      }

      closeOptionModalFn()
      await loadProductOptions(currentProductForOptions.id)
      renderProductOptionsDashboard()

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
// IMAGE UPLOAD FOR PRODUCTS
// ============================================
import { imageService } from '../../services/images.js'

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