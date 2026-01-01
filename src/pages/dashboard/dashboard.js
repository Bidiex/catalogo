import { authService } from '../../services/auth.js'
import { businessService } from '../../services/business.js'
import { categoryService } from '../../services/categories.js'
import { productService } from '../../services/products.js'

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
    alert('Error al cargar el dashboard')
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
    alert('Error al cargar los datos')
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
        <button class="btn-icon edit-category" data-id="${category.id}">Editar</button>
        <button class="btn-icon danger delete-category" data-id="${category.id}">Eliminar</button>
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
          <button class="btn-icon edit-product" data-id="${product.id}">Editar</button>
          <button class="btn-icon danger delete-product" data-id="${product.id}">Eliminar</button>
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
  if (!slugInput.disabled && !slugInput.value) {
    slugInput.value = businessService.generateSlug(e.target.value)
  }
})

document.getElementById('businessForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const name = document.getElementById('businessNameInput').value
  const slug = document.getElementById('businessSlugInput').value
  const whatsapp = document.getElementById('businessWhatsappInput').value
  const description = document.getElementById('businessDescriptionInput').value

  const saveBtn = document.getElementById('saveBusinessBtn')
  saveBtn.disabled = true
  saveBtn.textContent = 'Guardando...'

  try {
    const businessData = { name, slug, whatsapp_number: whatsapp, description }

    if (currentBusiness) {
      // Actualizar
      await businessService.updateBusiness(currentBusiness.id, businessData)
      alert('Negocio actualizado correctamente')
    } else {
      // Crear
      currentBusiness = await businessService.createBusiness(businessData)
      alert('Negocio creado correctamente')
    }

    closeBusinessModal()
    await loadBusiness()

  } catch (error) {
    console.error('Error saving business:', error)
    alert('Error al guardar el negocio: ' + error.message)
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'Guardar'
  }
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

  try {
    if (editingCategory) {
      // Actualizar
      await categoryService.update(editingCategory.id, { name })
      alert('Categoría actualizada')
    } else {
      // Crear
      await categoryService.create({
        business_id: currentBusiness.id,
        name,
        display_order: categories.length
      })
      alert('Categoría creada')
    }

    closeCategoryModal()
    await loadAllData()

  } catch (error) {
    console.error('Error saving category:', error)
    alert('Error al guardar la categoría')
  }
})

async function deleteCategory(categoryId) {
  if (!confirm('¿Eliminar esta categoría? Los productos mantendrán su información.')) return

  try {
    await categoryService.delete(categoryId)
    alert('Categoría eliminada')
    await loadAllData()
  } catch (error) {
    console.error('Error deleting category:', error)
    alert('Error al eliminar la categoría')
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
  productModal.style.display = 'flex'
}

function openEditProductModal(productId) {
  editingProduct = products.find(p => p.id === productId)
  if (!editingProduct) return

  document.getElementById('productModalTitle').textContent = 'Editar Producto'
  document.getElementById('productNameInput').value = editingProduct.name
  document.getElementById('productPriceInput').value = editingProduct.price
  document.getElementById('productDescriptionInput').value = editingProduct.description || ''
  document.getElementById('productImageInput').value = editingProduct.image_url || ''
  
  populateCategorySelect()
  document.getElementById('productCategoryInput').value = editingProduct.category_id || ''
  
  productModal.style.display = 'flex'
}

function closeProductModal() {
  productModal.style.display = 'none'
  editingProduct = null
  document.getElementById('productForm').reset()
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
  const imageUrl = document.getElementById('productImageInput').value

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
      alert('Producto actualizado')
    } else {
      // Crear
      await productService.create(productData)
      alert('Producto creado')
    }

    closeProductModal()
    await loadAllData()

  } catch (error) {
    console.error('Error saving product:', error)
    alert('Error al guardar el producto')
  }
})

async function deleteProduct(productId) {
  if (!confirm('¿Eliminar este producto?')) return

  try {
    await productService.delete(productId)
    alert('Producto eliminado')
    await loadAllData()
  } catch (error) {
    console.error('Error deleting product:', error)
    alert('Error al eliminar el producto')
  }
}

// ============================================
// OTROS EVENTOS
// ============================================
logoutBtn.addEventListener('click', async () => {
  if (!confirm('¿Cerrar sesión?')) return
  
  await authService.signOut()
  window.location.href = '/src/pages/login/index.html'
})

copyLinkBtn.addEventListener('click', async () => {
  const url = catalogLink.href
  try {
    await navigator.clipboard.writeText(url)
    copyLinkBtn.textContent = '¡Copiado!'
    setTimeout(() => {
      copyLinkBtn.textContent = 'Copiar'
    }, 2000)
  } catch (error) {
    alert('No se pudo copiar el enlace')
  }
})