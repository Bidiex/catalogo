/**
 * OPERATOR.JS — Gestión de Pedidos en Tiempo Real
 * TraeGo · /o/{slug}
 */

import { supabase } from '../../config/supabase.js'
import { operatorsService } from '../../services/operators.js'
import { ordersService } from '../../services/orders.js'
import { productService } from '../../services/products.js'
import { categoryService } from '../../services/categories.js'
import { imageService } from '../../services/images.js'
import { notify, confirm as confirmDialog } from '../../utils/notifications.js'
import { generateOrderInvoice, generateOrderTicket } from '../../utils/invoiceGenerator.js'
import { initAnalytics, updateAnalytics } from '../dashboard/analytics.js'

// ============================================================
// STATE & CONFIG
// ============================================================
const SESSION_KEY = 'traego_operator_session'
let currentOperator = null
let currentBusiness = null
let currentOrders = []
let allProducts = []
let allCategories = []
let ordersSubscription = null
let currentProductImage = ''
let uploadedImagePath = ''
let editingProductId = null

// DOM References
const screenLogin = document.getElementById('screen-login')
const screenMain = document.getElementById('screen-main')
const loginForm = document.getElementById('loginForm')
const operatorCodeInput = document.getElementById('operatorCode')
const loginError = document.getElementById('loginError')
const ordersGrid = document.getElementById('ordersGrid')
const orderCountEl = document.getElementById('orderCount')

// History DOM References
const tabActive = document.getElementById('tabActive')
const tabHistory = document.getElementById('tabHistory')
const historyTableBody = document.getElementById('historyTableBody')
const historyEmptyState = document.getElementById('historyEmptyState')
const filterHistoryId = document.getElementById('filterHistoryId')
const filterHistoryStatusSelect = null // Removed select
const filterStatusBtns = document.querySelectorAll('.status-btn')
let currentHistoryStatus = 'all'
const filterHistoryDate = document.getElementById('filterHistoryDate')
const btnClearHistoryFilters = document.getElementById('btnClearHistoryFilters')
const btnSearchHistory = document.getElementById('btnSearchHistory')

// Products DOM References
const tabProducts = document.getElementById('tabProducts')
const tabAnalytics = document.getElementById('tabAnalytics')
const productsGrid = document.getElementById('productsGrid')
const productsEmptyState = document.getElementById('productsEmptyState')
const filterProductsSearch = document.getElementById('filterProductsSearch')
const filterProductsCategory = document.getElementById('filterProductsCategory')
const btnNewProduct = document.getElementById('btnNewProduct')
const productModal = document.getElementById('productModal')
const productForm = document.getElementById('productForm')

// ============================================================
// BOOT
// ============================================================
async function init() {
    const slug = getSlugFromUrl()
    if (!slug) return window.location.href = '/404'

    // Resolver negocio por slug
    const business = await resolveBusiness(slug)
    if (!business) return window.location.href = '/404'
    currentBusiness = business

    const loginBizName = document.getElementById('loginBizName')
    const loginBizLogo = document.getElementById('loginBizLogo')
    if (loginBizName && currentBusiness) {
      loginBizName.textContent = currentBusiness.name
    }
    if (loginBizLogo && currentBusiness?.logo_url) {
      loginBizLogo.innerHTML = `<img src="${currentBusiness.logo_url}" alt="${currentBusiness.name}">`
    }

    // Intentar restaurar sesión
    const session = loadSession()
    if (session && session.businessId === business.id) {
        // Validar que el operador siga existiendo/activo
        const op = await operatorsService.validateAndLogin(session.uniqueCode, business.id)
        if (op && !op.error) {
            enterDashboard(op)
            return
        }
    }

    showLogin()

    // PIN boxes navigation
    const pinBoxes = document.querySelectorAll('.pin-box')
    const loginBtn = document.getElementById('loginBtn')
    pinBoxes.forEach((box, i) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '')
        e.target.value = val.slice(-1).toUpperCase()
        e.target.classList.toggle('filled', e.target.value !== '')
        const filled = Array.from(pinBoxes).every(b => b.value !== '')
        if (loginBtn) loginBtn.disabled = !filled
        if (val && i < pinBoxes.length - 1) pinBoxes[i + 1].focus()
      })
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          pinBoxes[i - 1].value = ''
          pinBoxes[i - 1].classList.remove('filled')
          pinBoxes[i - 1].focus()
          if (loginBtn) loginBtn.disabled = true
        }
      })
      box.addEventListener('paste', (e) => {
        e.preventDefault()
        const text = (e.clipboardData || window.clipboardData)
          .getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5)
        text.split('').forEach((char, idx) => {
          if (pinBoxes[idx]) {
            pinBoxes[idx].value = char
            pinBoxes[idx].classList.add('filled')
          }
        })
        if (loginBtn) loginBtn.disabled = text.length < 5
        if (pinBoxes[text.length - 1]) pinBoxes[text.length - 1].focus()
      })
    })
}

function getSlugFromUrl() {
    // Path: /o/{slug}
    const parts = window.location.pathname.split('/')
    const idx = parts.indexOf('o')
    return (idx !== -1 && parts[idx + 1]) ? parts[idx + 1] : null
}

async function resolveBusiness(slug) {
    const { data } = await supabase
        .from('businesses')
        .select('id, name, logo_url, slug, plan_type')
        .eq('slug', slug)
        .single()
    return data
}

// ============================================================
// AUTH & SESSION
// ============================================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const pins = document.querySelectorAll('.pin-box')
    const rawCode = Array.from(pins).map(p => p.value.toUpperCase()).join('')
    const code = `OP-${rawCode}`
    operatorCodeInput.value = code

    setLoginLoading(true)
    const result = await operatorsService.validateAndLogin(code, currentBusiness.id)

    if (result.error) {
        showLoginError(result.error)
        setLoginLoading(false)
        return
    }

    saveSession(result)
    enterDashboard(result)
})

function enterDashboard(operator) {
    currentOperator = operator
    
    // UI Setup
    screenLogin.classList.add('hidden')
    screenMain.classList.remove('hidden')
    
    document.getElementById('sidebarBizName').textContent = currentBusiness.name
    document.getElementById('sidebarOpName').textContent = operator.name
    const avatar = document.getElementById('headerOpAvatar')
    if (avatar) avatar.textContent = operator.name.charAt(0).toUpperCase()
    if (currentBusiness.logo_url) {
        document.getElementById('sidebarBizLogo').innerHTML = `<img src="${currentBusiness.logo_url}" alt="Logo">`
    }

    renderPermissions(operator.permissions)
    
    // Data load
    loadOrders()
    startRealtime()
    setupTabs()
    setupHistoryFilters()
    setupProductHandlers()
    initOperatorImageUpload()

    // Lógica del dropdown del operador
    const headerOperator = document.getElementById('headerOperator')
    const headerOpDropdown = document.getElementById('headerOpDropdown')
    const headerOpChevron = document.getElementById('headerOpChevron')
    if (headerOperator) {
      headerOperator.addEventListener('click', (e) => {
        e.stopPropagation()
        headerOpDropdown.classList.toggle('hidden')
        headerOpChevron.classList.toggle('open')
      })
      document.addEventListener('click', () => {
        headerOpDropdown.classList.add('hidden')
        headerOpChevron.classList.remove('open')
      })
    }
}

function renderPermissions(perms) {
    const labels = {
        manage_orders: 'Gestionar pedidos',
        create_products: 'Crear productos',
        edit_products: 'Editar productos',
        delete_products: 'Eliminar productos',
        view_analytics: 'Ver analíticas'
    }
    const container = document.getElementById('sidebarPerms')
    container.innerHTML = ''
    Object.keys(perms || {}).filter(k => perms[k]).forEach(k => {
        const span = document.createElement('span')
        span.className = 'perm-badge'
        span.textContent = labels[k] || k
        container.appendChild(span)
    })

    const hasProductsPerm = perms?.create_products || perms?.edit_products || perms?.delete_products
    if (hasProductsPerm) {
        document.getElementById('tabBtnProducts').classList.remove('hidden')
        if (perms.create_products) {
            document.getElementById('btnNewProduct').classList.remove('hidden')
        }
    }

    if (perms?.view_analytics) {
        document.getElementById('tabBtnAnalytics').classList.remove('hidden')
    }
}

function hasPermission(perm) {
    return !!(currentOperator?.permissions?.[perm])
}

function saveSession(op) {
    const data = {
        operatorId: op.id,
        uniqueCode: op.unique_code,
        businessId: currentBusiness.id,
        permissions: op.permissions
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY)
    window.location.reload()
})

// ============================================================
// ORDERS LOGIC
// ============================================================
async function loadOrders() {
    const activeStatuses = ['pending', 'verified', 'for_delivery', 'dispatched', 'ready_for_pickup']
    
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_token, customer_name, customer_phone, customer_address, total_amount, status, order_type, order_notes, created_at')
        .eq('business_id', currentBusiness.id)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('loadOrders error:', error)
        return
    }

    currentOrders = data
    renderOrders(data)
}

function setupTabs() {
    const tabs = document.querySelectorAll('.op-tab')

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'))
            tab.classList.add('active')

            const target = tab.dataset.tab
            
            tabActive.classList.add('hidden')
            tabHistory.classList.add('hidden')
            if (tabProducts) tabProducts.classList.add('hidden')
            if (tabAnalytics) tabAnalytics.classList.add('hidden')

            if (target === 'active') {
                tabActive.classList.remove('hidden')
                loadOrders()
            } else if (target === 'history') {
                tabHistory.classList.remove('hidden')
                loadHistory()
            } else if (target === 'products') {
                tabProducts.classList.remove('hidden')
                loadProducts()
            } else if (target === 'analytics') {
                tabAnalytics.classList.remove('hidden')
                loadOperatorAnalytics()
            }
        })
    })
}

async function loadOperatorAnalytics() {
    if (!currentBusiness) return
    try {
        const startDate = '2020-01-01'
        const endDate = new Date().toISOString().split('T')[0]
        const [orders, prods, cats] = await Promise.all([
            ordersService.getOrdersForExport(currentBusiness.id, { startDate, endDate, status: 'all' }),
            productService.getByBusiness(currentBusiness.id),
            categoryService.getByBusiness(currentBusiness.id)
        ])
        const completedOrders = (orders || []).filter(o => o.status === 'completed')
        initAnalytics(completedOrders, prods || [], cats || [])
    } catch (error) {
        console.error('Error loading analytics:', error)
        notify.error('Error al cargar analíticas')
    }
}

function setupHistoryFilters() {
    btnSearchHistory.addEventListener('click', loadHistory)
    btnClearHistoryFilters.addEventListener('click', () => {
        filterHistoryId.value = ''
        filterHistoryDate.value = ''
        currentHistoryStatus = 'all'
        document.querySelectorAll('.filter-pill').forEach(b => {
            b.classList.toggle('active', b.dataset.status === 'all')
        })
        loadHistory()
    })
    
    // Status Badges
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentHistoryStatus = e.target.dataset.status
            loadHistory()
        })
    })

    // Allow pressing enter on input
    filterHistoryId.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadHistory()
    })
}

async function loadHistory() {
    if (!currentBusiness) return

    historyTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;"><i class="ri-loader-4-line ri-spin" style="font-size: 2rem; color: var(--color-primary);"></i></td></tr>'
    historyEmptyState.classList.add('hidden')

    let query = supabase
        .from('orders')
        .select('id, order_token, customer_name, customer_phone, total_amount, status, order_type, created_at')
        .eq('business_id', currentBusiness.id)

    // Filters
    const searchId = filterHistoryId.value.trim()
    const statusVal = currentHistoryStatus
    const dateVal = filterHistoryDate.value

    if (statusVal !== 'all') {
        query = query.eq('status', statusVal)
    } else {
        query = query.in('status', ['completed', 'cancelled'])
    }

    if (dateVal) {
        // Simple date filtering (YYYY-MM-DD)
        const startOfDay = new Date(dateVal + 'T00:00:00')
        const endOfDay = new Date(dateVal + 'T23:59:59.999')
        
        query = query.gte('created_at', startOfDay.toISOString())
        query = query.lte('created_at', endOfDay.toISOString())
    }

    // Traemos un bloque más grande (ej: 200) para poder filtrar localmente IDs
    query = query.order('created_at', { ascending: false }).limit(200)

    const { data, error } = await query

    if (error) {
        console.error('Error loading history:', error)
        historyTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Error al cargar historial</td></tr>'
        return
    }

    let filteredData = data
    if (searchId) {
        const term = searchId.replace(/^#/, '').trim().toLowerCase()
        filteredData = data.filter(o => 
            (o.id && o.id.toLowerCase().includes(term)) ||
            (o.order_token && o.order_token.toLowerCase().includes(term)) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
            (o.customer_phone && o.customer_phone.toLowerCase().includes(term))
        )
    }

    renderHistory(filteredData)
}

// ============================================================
// PRODUCT MANAGEMENT
// ============================================================

async function loadProducts() {
    if (!currentBusiness) return
    
    try {
        allCategories = await categoryService.getByBusiness(currentBusiness.id)
        populateOperatorCategorySelect()
    } catch (e) {
        console.error('Error loading categories:', e)
    }

    productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><i class="ri-loader-4-line ri-spin" style="font-size: 2rem; color: var(--color-primary);"></i></div>'
    productsEmptyState.classList.add('hidden')

    try {
        allProducts = await productService.getByBusiness(currentBusiness.id)
        renderProducts(allProducts)
    } catch (error) {
        console.error('Error loading products:', error)
        productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">Error al cargar productos</div>'
    }
}

function renderCategorySelect() {
    const select = document.getElementById('prodCategory')
    if (!select) return
    select.innerHTML = '<option value="">Selecciona una categoría</option>'
    allCategories.forEach(cat => {
        const opt = document.createElement('option')
        opt.value = cat.id
        opt.textContent = cat.name
        select.appendChild(opt)
    })
}

function renderProducts(products) {
    productsGrid.innerHTML = ''
    
    const searchTerm = filterProductsSearch?.value.trim().toLowerCase() || ''
    const categoryFilter = filterProductsCategory?.value || ''
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        const matchesCategory = !categoryFilter || p.category_id === categoryFilter
        return matchesSearch && matchesCategory
    })

    if (filtered.length === 0) {
        productsEmptyState.classList.remove('hidden')
        return
    }

    productsEmptyState.classList.add('hidden')
    
    filtered.forEach(product => {
        const card = document.createElement('div')
        card.className = 'product-card'
        
        const canEdit = currentOperator?.permissions?.edit_products
        const canDelete = currentOperator?.permissions?.delete_products

        const categoryName = allCategories.find(c => c.id === product.category_id)?.name || ''
        const isActive = product.is_active !== false

        card.innerHTML = `
            <div class="product-card-image">
                ${product.image_url
                    ? `<img src="${product.image_url}" alt="${product.name}">`
                    : '<div class="no-image"><i class="ri-image-line"></i></div>'
                }
            </div>
            <div class="product-card-content">
                <div class="product-card-name">${product.name}</div>
                <div class="product-card-price">$${parseFloat(product.price).toLocaleString('es-CO')}</div>
                ${categoryName
                    ? `<div class="product-card-category">${categoryName}</div>`
                    : ''
                }
                <div class="product-card-status">
                    ${isActive
                        ? `<span class="status-badge status-active"><i class="ri-checkbox-circle-line"></i> Activo</span>`
                        : `<span class="status-badge status-inactive"><i class="ri-eye-off-line"></i> Inactivo</span>`
                    }
                </div>
                ${(canEdit || canDelete) ? `
                <div class="product-card-actions">
                    ${canEdit ? `
                    <button class="btn-icon edit-product-op" data-id="${product.id}">
                        <i class="ri-edit-line"></i><span> Editar</span>
                    </button>` : ''}
                    ${canDelete ? `
                    <button class="btn-icon danger delete-product-op" data-id="${product.id}">
                        <i class="ri-delete-bin-line"></i><span> Eliminar</span>
                    </button>` : ''}
                </div>` : ''}
            </div>
        `
        productsGrid.appendChild(card)
    })

    // Delegación de eventos en el grid
    productsGrid.onclick = (e) => {
        const editBtn = e.target.closest('.edit-product-op')
        const deleteBtn = e.target.closest('.delete-product-op')
        if (editBtn) window.editProduct(editBtn.dataset.id)
        if (deleteBtn) window.deleteProduct(deleteBtn.dataset.id)
    }
}

function setupProductHandlers() {
    if (filterProductsSearch) {
        filterProductsSearch.addEventListener('input', () => renderProducts(allProducts))
    }

    if (filterProductsCategory) {
        filterProductsCategory.addEventListener('change', () => renderProducts(allProducts))
    }
    
    if (btnNewProduct) {
        btnNewProduct.addEventListener('click', () => {
            editingProductId = null
            document.getElementById('productModalTitle').textContent = 'Nuevo Producto'
            document.getElementById('productForm').reset()

            const activeInput = document.getElementById('productActiveInput')
            const activeLabel = document.getElementById('productActiveLabel')
            if (activeInput) {
                activeInput.checked = true
                if (activeLabel) activeLabel.textContent = 'Activo'
                activeInput.onchange = () => {
                    if (activeLabel) activeLabel.textContent = activeInput.checked ? 'Activo' : 'Inactivo'
                }
            }

            populateOperatorCategorySelect()
            resetOperatorProductImage()

            productModal.classList.remove('hidden')
            productModal.style.display = 'flex'
        })
    }

    const closeProductModalFn = () => {
        productModal.classList.add('hidden')
        productModal.style.display = 'none'
        resetOperatorProductImage()
        editingProductId = null
    }

    document.getElementById('closeProductModal')?.addEventListener('click', closeProductModalFn)
    document.getElementById('cancelProductBtn')?.addEventListener('click', closeProductModalFn)

    productForm?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const saveBtn = document.getElementById('saveProductBtn')
        const oldText = saveBtn.textContent
        saveBtn.disabled = true
        saveBtn.textContent = 'Guardando...'

        const activeInput = document.getElementById('productActiveInput')
        const imageUrl = document.getElementById('productImageUrlHidden').value || currentProductImage || ''

        const productData = {
            business_id: currentBusiness.id,
            name: document.getElementById('productNameInput').value,
            description: document.getElementById('productDescriptionInput').value,
            price: parseFloat(document.getElementById('productPriceInput').value),
            category_id: document.getElementById('productCategoryInput').value || null,
            image_url: imageUrl || null,
            is_active: activeInput ? activeInput.checked : true
        }

        try {
            if (editingProductId) {
                await productService.update(editingProductId, productData)
                notify.success('Producto actualizado')
            } else {
                await productService.create(productData)
                notify.success('Producto creado')
            }
            productModal.classList.add('hidden')
            productModal.style.display = 'none'
            editingProductId = null
            loadProducts()
        } catch (error) {
            notify.error('Error al guardar producto: ' + error.message)
        } finally {
            saveBtn.disabled = false
            saveBtn.textContent = oldText
        }
    })
}

window.editProduct = (id) => {
    const product = allProducts.find(p => p.id === id)
    if (!product) return

    editingProductId = product.id
    document.getElementById('productModalTitle').textContent = 'Editar Producto'
    document.getElementById('productNameInput').value = product.name
    document.getElementById('productPriceInput').value = product.price
    document.getElementById('productDescriptionInput').value = product.description || ''

    populateOperatorCategorySelect()
    document.getElementById('productCategoryInput').value = product.category_id || ''

    const activeInput = document.getElementById('productActiveInput')
    const activeLabel = document.getElementById('productActiveLabel')
    if (activeInput) {
        const isActive = product.is_active !== false
        activeInput.checked = isActive
        if (activeLabel) activeLabel.textContent = isActive ? 'Activo' : 'Inactivo'
        activeInput.onchange = () => {
            if (activeLabel) activeLabel.textContent = activeInput.checked ? 'Activo' : 'Inactivo'
        }
    }

    if (product.image_url) {
        currentProductImage = product.image_url
        document.getElementById('productImageUrlHidden').value = product.image_url
        document.getElementById('productImagePreview').innerHTML = `<img src="${product.image_url}" alt="Preview">`
        document.getElementById('productImagePreview').classList.add('has-image')
        document.getElementById('imageUploadActions').style.display = 'flex'
    } else {
        resetOperatorProductImage()
    }

    productModal.classList.remove('hidden')
    productModal.style.display = 'flex'
}

window.deleteProduct = async (id) => {
    const confirmed = await confirmDialog.show({
        title: '¿Eliminar producto?',
        message: '¿Estás seguro? Esta acción no se puede deshacer.'
    })
    if (!confirmed) return

    try {
        await productService.delete(id)
        loadProducts()
    } catch (error) {
        notify.error('Error al eliminar producto: ' + error.message)
    }
}

function renderHistory(orders) {
    historyTableBody.innerHTML = ''
    
    if (!orders || orders.length === 0) {
        historyEmptyState.classList.remove('hidden')
        return
    }
    
    historyEmptyState.classList.add('hidden')

    orders.forEach(order => {
        const ref = order.order_token ? order.order_token.toString().split('-')[0].toUpperCase() : order.id.slice(0,8).toUpperCase()
        const date = new Date(order.created_at).toLocaleString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        const orderTypeStr = order.order_type === 'pickup' ? 'Retiro' : 'Domicilio'
        
        const tr = document.createElement('tr')
        tr.innerHTML = `
            <td style="font-weight: 600;">#${ref}</td>
            <td>${date}</td>
            <td>
                <div style="font-weight: 600;">${order.customer_name}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${order.customer_phone || '-'}</div>
            </td>
            <td><span class="order-type-badge ${order.order_type === 'pickup' ? 'retiro' : ''}" style="display: inline-block;">${orderTypeStr}</span></td>
            <td><span class="status-badge status-${order.status}">${formatStatus(order.status)}</span></td>
            <td style="font-weight: 700; color: var(--color-primary);">$${parseFloat(order.total_amount).toLocaleString('es-CO')}</td>
            <td>
                <button class="btn-view-detail" onclick="window.viewOrderDetails('${order.id}')" title="Ver Detalle">
                    <i class="ri-eye-line"></i>
                </button>
            </td>
        `
        historyTableBody.appendChild(tr)
    })
}

function renderOrders(orders) {
    ordersGrid.innerHTML = ''
    orderCountEl.textContent = orders.length

    if (orders.length === 0) {
        ordersGrid.innerHTML = `
            <div class="empty-state">
                <i class="ri-file-list-3-line"></i>
                <p>No hay pedidos activos en este momento.</p>
            </div>`
        return
    }

    orders.forEach(order => {
        const card = document.createElement('div')
        card.className = 'order-card'

        const ref = order.order_token
            ? order.order_token.toString().slice(0, 8).toUpperCase()
            : order.id.slice(0, 8).toUpperCase()

        const orderType = order.order_type === 'pickup' ? 'Retiro' : 'Domicilio'
        const orderTypeClass = order.order_type === 'pickup' ? 'retiro' : ''

        let orderTime = new Date(order.created_at)
        let diffMins = Math.floor((new Date() - orderTime) / 60000)
        let elapsedClass = 'elapsed-good'
        if (diffMins >= 20) {
            elapsedClass = 'elapsed-danger'
            card.classList.add('delayed-order')
        } else if (diffMins >= 10) {
            elapsedClass = 'elapsed-amber'
        }
        
        let elapsedStr = diffMins < 1 ? 'Ahora' : (diffMins < 60 ? diffMins + ' min' : Math.floor(diffMins/60) + 'h ' + (diffMins%60) + 'm')

        card.innerHTML = `
            <div class="card-top">
                <span class="order-ref">#${ref}</span>
                <span class="order-type-badge ${orderTypeClass}">${orderType}</span>
                <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
                <span class="order-elapsed ${elapsedClass} time-tracker" data-created="${order.created_at}" style="margin-left: auto;"><i class="ri-time-line"></i> ${elapsedStr}</span>
            </div>
            <div class="customer-name">${order.customer_name}</div>
            ${order.customer_phone ? `<div class="customer-phone"><i class="ri-phone-line"></i>${order.customer_phone}</div>` : ''}
            ${order.customer_address ? `<div class="order-address"><i class="ri-map-pin-line"></i>${order.customer_address}</div>` : ''}
            <div class="card-divider"></div>
            <div class="order-total">$${parseFloat(order.total_amount).toLocaleString('es-CO')}</div>
            <div class="card-actions" id="actions-${order.id}">
                <button class="btn-detail" onclick="window.viewOrderDetails('${order.id}')">
                    <i class="ri-file-list-line"></i> Ver Detalle
                </button>
            </div>
        `
        ordersGrid.appendChild(card)
        renderActionButtons(order)
    })
}

function renderActionButtons(order) {
    const container = document.getElementById(`actions-${order.id}`)
    if (!container) return

    const canManage = hasPermission('manage_orders')
    if (!canManage) return

    const isPro = currentBusiness?.plan_type === 'pro'
    const isDelivery = order.order_type !== 'pickup'

    const buttons = []

    if (order.status === 'pending') {
        buttons.push({
            text: 'Verificar',
            icon: 'ri-checkbox-circle-line',
            style: 'action',
            onclick: () => confirmStatusChange(order.id, 'verified', '¿Verificar pedido?', 'El pedido pasará a estado verificado.')
        })
    }

    if (order.status === 'verified') {
        if (isDelivery && isPro) {
            buttons.push({
                text: 'Para llevar',
                icon: 'ri-e-bike-line',
                style: 'secondary',
                onclick: () => confirmStatusChange(order.id, 'for_delivery', '¿Marcar como "Para llevar"?', 'El pedido quedará disponible para domiciliarios.')
            })
            buttons.push({
                text: 'Despachar',
                icon: 'ri-motorbike-line',
                style: 'action',
                onclick: () => openAssignModal(order.id, order.order_token)
            })
        } else if (isDelivery && !isPro) {
            buttons.push({
                text: 'Despachar',
                icon: 'ri-motorbike-line',
                style: 'action',
                onclick: () => openAssignModal(order.id, order.order_token)
            })
        } else {
            buttons.push({
                text: 'Listo para retirar',
                icon: 'ri-store-line',
                style: 'action',
                onclick: () => confirmStatusChange(order.id, 'ready_for_pickup', '¿Listo para retirar?', 'El cliente podrá venir a recoger su pedido.')
            })
        }
    }

    if (order.status === 'for_delivery') {
        buttons.push({
            text: 'Despachar',
            icon: 'ri-motorbike-line',
            style: 'action',
            onclick: () => openAssignModal(order.id, order.order_token)
        })
    }

    if (order.status === 'dispatched' || order.status === 'ready_for_pickup') {
        buttons.push({
            text: 'Completar',
            icon: 'ri-check-double-line',
            style: 'success',
            onclick: () => confirmStatusChange(order.id, 'completed', '¿Completar pedido?', 'El pedido se marcará como completado.')
        })
    }

    buttons.forEach(btn => {
        const el = document.createElement('button')
        el.className = `btn-action btn-action-${btn.style}`
        el.innerHTML = `<i class="${btn.icon}"></i>${btn.text}`
        el.onclick = btn.onclick
        container.appendChild(el)
    })
}

async function changeOrderStatus(orderId, newStatus) {
    if (!hasPermission('manage_orders')) {
        notify.error('No tienes permiso para gestionar pedidos.')
        return
    }

    try {
        await ordersService.updateStatus(orderId, newStatus)
        loadOrders() 
    } catch (error) {
        console.error('Error al actualizar pedido:', error)
        notify.error('Error al actualizar: ' + (error.message || 'Error desconocido'))
    }
}

async function confirmStatusChange(orderId, newStatus, title, message) {
    const confirmed = await confirmDialog.show({ title, message })
    if (!confirmed) return
    await changeOrderStatus(orderId, newStatus)
}

async function openAssignModal(orderId, orderToken) {
    if (!hasPermission('manage_orders')) return

    const ref = orderToken
        ? orderToken.toString().slice(0, 8).toUpperCase()
        : orderId.slice(0, 8).toUpperCase()

    const modal = document.getElementById('opAssignModal')
    document.getElementById('opAssignOrderRef').textContent = `#${ref}`
    window._assigningOrderId = orderId

    // Cargar domiciliarios activos
    const { data } = await supabase
        .from('delivery_persons')
        .select('id, name, vehicle_type, unique_code')
        .eq('business_id', currentBusiness.id)
        .eq('is_active', true)
        .order('name')

    const list = document.getElementById('opAssignList')
    list.innerHTML = ''

    if (!data || data.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem;">No hay domiciliarios activos.</p>'
    } else {
        data.forEach(dp => {
            const item = document.createElement('div')
            item.className = 'op-assign-item'
            item.innerHTML = `
                <div class="op-assign-info">
                    <strong>${dp.name}</strong>
                    <span>${dp.vehicle_type} · ${dp.unique_code}</span>
                </div>
                <button class="btn-action" onclick="selectDeliveryPerson('${dp.id}', '${dp.name}')">
                    Asignar
                </button>
            `
            list.appendChild(item)
        })
    }

    modal.classList.remove('hidden')
    modal.style.display = 'flex'
}

window.selectDeliveryPerson = async (deliveryPersonId, name) => {
    const orderId = window._assigningOrderId
    if (!orderId) return

    const confirmed = await confirmDialog.show({
        title: '¿Despachar pedido?',
        message: `¿Asignar a ${name} y despachar el pedido?`
    })
    if (!confirmed) return

    try {
        await ordersService.assignDeliveryPerson(orderId, deliveryPersonId)
        const m = document.getElementById('opAssignModal')
        m.classList.add('hidden')
        m.style.display = 'none'
        window._assigningOrderId = null
        loadOrders()
    } catch (error) {
        notify.error('Error al asignar domiciliario: ' + error.message)
    }
}

// ============================================================
// REALTIME & HELPERS
// ============================================================
function startRealtime() {
    if (ordersSubscription) supabase.removeChannel(ordersSubscription)

    ordersSubscription = supabase
        .channel('operator-orders')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders',
            filter: `business_id=eq.${currentBusiness.id}`
        }, () => {
            loadOrders()
        })
        .subscribe()
}

function populateOperatorCategorySelect() {
    const select = document.getElementById('productCategoryInput')
    if (select) {
        select.innerHTML = '<option value="">Sin categoría</option>'
        allCategories.forEach(cat => {
            const opt = document.createElement('option')
            opt.value = cat.id
            opt.textContent = cat.name
            select.appendChild(opt)
        })
    }

    // También poblar el select de filtro
    const filterSelect = document.getElementById('filterProductsCategory')
    if (filterSelect) {
        const currentVal = filterSelect.value
        filterSelect.innerHTML = '<option value="">Todas las categorías</option>'
        allCategories.forEach(cat => {
            const opt = document.createElement('option')
            opt.value = cat.id
            opt.textContent = cat.name
            filterSelect.appendChild(opt)
        })
        filterSelect.value = currentVal // preservar selección actual
    }
}

function resetOperatorProductImage() {
    currentProductImage = ''
    uploadedImagePath = ''
    const preview = document.getElementById('productImagePreview')
    const hidden = document.getElementById('productImageUrlHidden')
    const actions = document.getElementById('imageUploadActions')
    if (preview) {
        preview.innerHTML = '<i class="ri-image-add-line"></i><span>Sin imagen</span>'
        preview.classList.remove('has-image')
    }
    if (hidden) hidden.value = ''
    if (actions) actions.style.display = 'none'
}

// ─── Upload de imagen de producto (Operador) ───

function initOperatorImageUpload() {
    const productImageInput = document.getElementById('productImageInput')
    const productImagePreview = document.getElementById('productImagePreview')
    const imageUploadActions = document.getElementById('imageUploadActions')
    const imageUploadProgress = document.getElementById('imageUploadProgress')
    const changeImageBtn = document.getElementById('changeImageBtn')
    const removeImageBtn = document.getElementById('removeImageBtn')

    if (!productImageInput) return

    productImagePreview?.addEventListener('click', () => {
        if (!productImagePreview.classList.contains('has-image')) {
            productImageInput.click()
        }
    })

    changeImageBtn?.addEventListener('click', () => {
        productImageInput.click()
    })

    removeImageBtn?.addEventListener('click', () => {
        resetOperatorProductImage()
    })

    productImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]
        if (!file) return

        const maxSizeInBytes = 2 * 1024 * 1024
        if (file.size > maxSizeInBytes) {
            e.target.value = ''
            notify.error('La imagen supera el límite de 2MB.')
            return
        }

        try {
            if (imageUploadProgress) imageUploadProgress.style.display = 'block'
            if (imageUploadActions) imageUploadActions.style.display = 'none'

            const resizedFile = await imageService.resizeImage(file, 800, 800, 0.85)
            const result = await imageService.upload(resizedFile, 'products')

            if (!result.success) throw new Error(result.error)

            currentProductImage = result.url
            uploadedImagePath = result.path
            document.getElementById('productImageUrlHidden').value = result.url

            if (productImagePreview) {
                productImagePreview.innerHTML = `<img src="${result.url}" alt="Preview">`
                productImagePreview.classList.add('has-image')
            }

            if (imageUploadProgress) imageUploadProgress.style.display = 'none'
            if (imageUploadActions) imageUploadActions.style.display = 'flex'

        } catch (error) {
            console.error('Error uploading image:', error)
            if (imageUploadProgress) imageUploadProgress.style.display = 'none'
            notify.error('Error al subir la imagen: ' + error.message)
        }
    })
}

function formatStatus(status) {
    const map = {
        pending: 'Pendiente',
        verified: 'Verificado',
        for_delivery: 'Para llevar',
        dispatched: 'En camino',
        completed: 'Completado',
        cancelled: 'Cancelado'
    }
    return map[status] || status
}

function showLoginError(msg) {
    loginError.textContent = msg
    loginError.classList.remove('hidden')
}

function setLoginLoading(loading) {
    const btn = document.getElementById('loginBtn')
    btn.disabled = loading
    btn.textContent = loading ? 'Validando...' : 'Ingresar al Panel'
}

function showLogin() {
    screenLogin.classList.remove('hidden')
    screenMain.classList.add('hidden')
}

// ============================================================
// ORDER DETAILS MODAL
// ============================================================
window.viewOrderDetails = async (orderId) => {
    const modal = document.getElementById('orderDetailsModal')
    const content = document.getElementById('orderDetailsContent')
    const footer = document.getElementById('orderDetailsFooter')
    const deliveryNoteContainer = document.getElementById('deliveryNoteContainer')
    const deliveryNoteText = document.getElementById('deliveryNoteText')

    content.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="ri-loader-4-line ri-spin" style="font-size: 2rem; color: var(--color-primary);"></i><p>Cargando detalles...</p></div>'
    footer.style.display = 'none'
    deliveryNoteContainer.style.display = 'none'
    modal.classList.remove('hidden')

    try {
        const orderData = await ordersService.getOrderDetails(orderId)
        if (!orderData) throw new Error('No data')

        // Fetch operator logic / specific notes
        if (orderData.delivery_person_id) {
            const { data: dpData } = await supabase
                .from('delivery_persons')
                .select('name, unique_code')
                .eq('id', orderData.delivery_person_id)
                .single()
            if (dpData) {
                orderData.delivery_person_name = dpData.name
            }
        }

        const date = new Date(orderData.created_at).toLocaleString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        const orderRefData = orderData.order_token ? orderData.order_token.split('-')[0].toUpperCase() : orderData.id.slice(0, 8).toUpperCase()
        const orderTypeStr = orderData.order_type === 'pickup' ? 'Retiro en Tienda' : 'Domicilio'

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                <div>
                    <h4 style="font-size: 1.2rem; margin: 0 0 0.25rem 0;">#${orderRefData}</h4>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${date}</div>
                </div>
                <div style="text-align: right;">
                    <span class="status-badge status-${orderData.status}">${formatStatus(orderData.status)}</span>
                    <div style="font-size: 0.85rem; font-weight: 600; margin-top: 0.25rem;">${orderTypeStr}</div>
                </div>
            </div>

            <div class="op-modal-grid">
                <div class="op-modal-field">
                    <label>Cliente</label>
                    <div class="value">${orderData.customer_name}</div>
                </div>
                <div class="op-modal-field">
                    <label>Teléfono</label>
                    <div class="value">${orderData.customer_phone || '-'}</div>
                </div>
                ${orderData.order_type !== 'pickup' ? `
                <div class="op-modal-field full">
                    <label>Dirección</label>
                    <div class="value">${orderData.customer_address || '-'} ${orderData.customer_neighborhood ? `(${orderData.customer_neighborhood})` : ''}</div>
                </div>
                ` : ''}
                ${orderData.delivery_person_name ? `
                <div class="op-modal-field full" style="background: #f5f3ff; padding: 0.75rem; border-radius: 8px;">
                    <label style="color: #5b21b6;"><i class="ri-motorbike-fill"></i> Domiciliario Asignado</label>
                    <div class="value" style="color: #4c1d95;">${orderData.delivery_person_name}</div>
                </div>
                ` : ''}
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.5rem; display: block;">PRODUCTOS</label>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;" id="orderDetailsItems">
                </div>
            </div>
        `

        // Items logic
        const itemsContainer = content.querySelector('#orderDetailsItems')
        let baseSubtotal = 0
        let productTaxesTotal = {}
        
        if (orderData.items && orderData.items.length > 0) {
            orderData.items.forEach(item => {
                const itemTotal = parseFloat(item.total_price || (item.unit_price * item.quantity))
                baseSubtotal += itemTotal
                
                if (item.options?.applied_product_taxes) {
                    item.options.applied_product_taxes.forEach(t => {
                        const taxAmt = itemTotal * (parseFloat(t.rate) / 100)
                        productTaxesTotal[t.name] = (productTaxesTotal[t.name] || 0) + taxAmt
                    })
                }

                let optionsHtml = ''

                // 1. Grupos de Opciones
                if (item.options?.groups && item.options.groups.length > 0) {
                    optionsHtml += item.options.groups.map(group => {
                        const selections = group.selections.map(s => {
                            return parseFloat(s.price) > 0 ? `${s.name} (+$${parseFloat(s.price).toLocaleString()})` : s.name
                        }).join(', ')
                        return `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;"><strong>${group.name}:</strong> ${selections}</div>`
                    }).join('')
                }

                // 2. Comentarios Rápidos
                if (item.options?.quickComments && item.options.quickComments.length > 0) {
                    optionsHtml += item.options.quickComments.map(c =>
                        `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Nota: ${c.name}</div>`
                    ).join('')
                } else if (item.options?.quickComment) {
                    optionsHtml += `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Nota: ${item.options.quickComment.name}</div>`
                }

                // 3. Acompañantes
                if (item.options?.sides && item.options.sides.length > 0) {
                    optionsHtml += `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">+ ${item.options.sides.map(s => s.name).join(', ')}</div>`
                }
                
                // 4. Tamaño
                if (item.options?.size) {
                    optionsHtml += `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Tamaño: ${item.options.size.name}</div>`
                }

                itemsContainer.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.5rem; background: #f8fafc; border-radius: 6px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 0.9rem;">${item.quantity}x ${item.product_name}</div>
                            ${optionsHtml}
                        </div>
                        <div style="font-weight: 600; font-size: 0.9rem;">$${itemTotal.toLocaleString('es-CO')}</div>
                    </div>
                `
            })
        } else {
            itemsContainer.innerHTML = `<div style="font-size: 0.85rem; color: #94a3b8; font-style: italic;">Sin productos detallados</div>`
        }

        let aggregatedProductTaxesTotal = 0
        let productTaxesHtml = ''
        for (const [name, amount] of Object.entries(productTaxesTotal)) {
            aggregatedProductTaxesTotal += amount
            productTaxesHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                    <span>${name} (Prod.)</span>
                    <span>$${Math.round(amount).toLocaleString('es-CO')}</span>
                </div>
            `
        }

        let invoiceTaxesHtml = ''
        const firstItem = orderData.items && orderData.items[0]
        if (firstItem && firstItem.options?.applied_invoice_taxes) {
            const subWithProdTaxes = baseSubtotal + aggregatedProductTaxesTotal
            firstItem.options.applied_invoice_taxes.forEach(t => {
                const taxAmt = subWithProdTaxes * (parseFloat(t.rate) / 100)
                invoiceTaxesHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem; color: #6b7280;">
                        <span>${t.name} (${t.rate}%)</span>
                        <span>$${Math.round(taxAmt).toLocaleString('es-CO')}</span>
                    </div>
                `
            })
        }

        // Totals
        content.innerHTML += `
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Subtotal (base)</span>
                    <span>$${Math.round(baseSubtotal).toLocaleString('es-CO')}</span>
                </div>
                ${productTaxesHtml}
                ${invoiceTaxesHtml}
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Domicilio</span>
                    <span>$${parseFloat(orderData.delivery_price || 0).toLocaleString('es-CO')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;">
                    <span>Total</span>
                    <span style="color: var(--color-primary);">$${Math.round(orderData.total_amount).toLocaleString('es-CO')}</span>
                </div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280; text-align: right;">
                    Método de Pago: <strong>${orderData.payment_method || 'N/A'}</strong>
                </div>
            </div>
        `

        // Internal Notes logic
        if (orderData.order_notes) {
            deliveryNoteText.textContent = orderData.order_notes
            deliveryNoteContainer.style.display = 'block'
        }

        // Add action buttons
        if (hasPermission('manage_orders')) {
            footer.innerHTML = `
                <div style="display: flex; gap: 0.5rem; flex: 1;">
                    <button class="btn-ticket" onclick="window.printOrderTicket('${orderId}')" title="Imprimir Ticket Cocina">
                        <i class="ri-printer-line"></i> Ticket
                    </button>
                    <button class="btn-invoice" onclick="window.printOrderInvoice('${orderId}')" title="Imprimir Factura">
                        <i class="ri-file-text-line"></i> Factura
                    </button>
                </div>
            `

            // Wrapper for right-side action buttons
            let actionButtons = ''

            // Action buttons specific to the status
            const isPro = currentBusiness?.plan_type === 'pro'
            const isDelivery = orderData.order_type !== 'pickup'
            const ctaStyle = 'min-width: 140px; justify-content: center;'

            if (orderData.status === 'pending') {
                actionButtons += `<button class="btn-primary" style="${ctaStyle}" onclick="window.verifyOrder('${orderId}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Verificar</button>`
            } else if (orderData.status === 'verified') {
                if (isDelivery && isPro) {
                    actionButtons += `<button class="btn-action-secondary" style="padding: 0.5rem 1rem; border-radius: var(--radius-md); font-weight: 600;" onclick="window.markAsForDelivery('${orderId}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Para llevar</button>`
                    actionButtons += `<button class="btn-primary" style="${ctaStyle}" onclick="window.openAssignModal('${orderId}', '${orderData.order_token}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Despachar</button>`
                } else if (isDelivery && !isPro) {
                    actionButtons += `<button class="btn-primary" style="${ctaStyle}" onclick="window.openAssignModal('${orderId}', '${orderData.order_token}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Despachar</button>`
                } else {
                    actionButtons += `<button class="btn-primary" style="${ctaStyle}" onclick="window.markAsReadyForPickup('${orderId}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Listo para retirar</button>`
                }
            } else if (orderData.status === 'for_delivery') {
                actionButtons += `<button class="btn-primary" style="${ctaStyle}" onclick="window.openAssignModal('${orderId}', '${orderData.order_token}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Despachar</button>`
            } else if (orderData.status === 'dispatched' || orderData.status === 'ready_for_pickup') {
                actionButtons += `<button class="btn-primary btn-action-success" style="${ctaStyle}" onclick="window.completeOrder('${orderId}'); document.getElementById('orderDetailsModal').classList.add('hidden')">Completar</button>`
            }

            footer.innerHTML += `<div style="display: flex; gap: 0.5rem; justify-content: flex-end;">${actionButtons}</div>`
        } else {
            footer.innerHTML = `<button class="btn-secondary" onclick="document.getElementById('orderDetailsModal').classList.add('hidden')">Cerrar</button>`
        }

        footer.style.display = 'flex'

    } catch (error) {
        console.error('Error load order detail:', error)
        content.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--danger);">Error al cargar detalle del pedido</div>`
    }
}

// Modal closing logic
document.getElementById('closeOrderDetailsBtn').addEventListener('click', () => {
    document.getElementById('orderDetailsModal').classList.add('hidden')
})
document.getElementById('orderDetailsModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderDetailsModal') document.getElementById('orderDetailsModal').classList.add('hidden')
})

// Printing logic
window.printOrderInvoice = async (orderId) => {
    try {
        const fullOrder = await ordersService.getOrderDetails(orderId)
        await generateOrderInvoice(fullOrder, currentBusiness)
    } catch (error) {
        console.error('Invoice error:', error)
        notify.error('Error al generar factura')
    }
}

window.printOrderTicket = async (orderId) => {
    try {
        const fullOrder = await ordersService.getOrderDetails(orderId)
        await generateOrderTicket(fullOrder, currentBusiness)
    } catch (error) {
        console.error('Ticket error:', error)
        notify.error('Error al generar ticket')
    }
}

// Status update wrappers for modal buttons
window.verifyOrder = (id) => confirmStatusChange(id, 'verified', '¿Verificar pedido?', 'Pasará a estado verificado.')
window.markAsForDelivery = (id) => confirmStatusChange(id, 'for_delivery', '¿Marcar "Para llevar"?', 'Quedará para domiciliarios.')
window.markAsReadyForPickup = (id) => confirmStatusChange(id, 'ready_for_pickup', '¿Listo para retirar?', 'El cliente podrá recogerlo.')
window.completeOrder = (id) => confirmStatusChange(id, 'completed', '¿Completar pedido?', 'Se marcará como entregado.')

// Auto update order timers
setInterval(() => {
    document.querySelectorAll('.time-tracker').forEach(el => {
        const createdAt = el.dataset.created;
        if (!createdAt) return;
        const diffMins = Math.floor((new Date() - new Date(createdAt)) / 60000);
        let elapsedStr = diffMins < 1 ? 'Ahora' : (diffMins < 60 ? diffMins + ' min' : Math.floor(diffMins/60) + 'h ' + (diffMins%60) + 'm');
        
        el.innerHTML = `<i class="ri-time-line"></i> ${elapsedStr}`;
        
        el.classList.remove('elapsed-good', 'elapsed-amber', 'elapsed-danger');
        if (diffMins >= 20) {
            el.classList.add('elapsed-danger');
            el.closest('.order-card')?.classList.add('delayed-order');
        } else if (diffMins >= 10) {
            el.classList.add('elapsed-amber');
        } else {
            el.classList.add('elapsed-good');
        }
    });
}, 60000);

// Start
init()
