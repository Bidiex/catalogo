/**
 * OPERATOR.JS — Gestión de Pedidos en Tiempo Real
 * TraeGo · /o/{slug}
 */

import { supabase } from '../../config/supabase.js'
import { operatorsService } from '../../services/operators.js'
import { ordersService } from '../../services/orders.js'

// ============================================================
// STATE & CONFIG
// ============================================================
const SESSION_KEY = 'traego_operator_session'
let currentOperator = null
let currentBusiness = null
let currentOrders = []
let ordersSubscription = null

// DOM References
const screenLogin = document.getElementById('screen-login')
const screenMain = document.getElementById('screen-main')
const loginForm = document.getElementById('loginForm')
const operatorCodeInput = document.getElementById('operatorCode')
const loginError = document.getElementById('loginError')
const ordersGrid = document.getElementById('ordersGrid')
const orderCountEl = document.getElementById('orderCount')

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
        .select('id, name, logo_url, slug')
        .eq('slug', slug)
        .single()
    return data
}

// ============================================================
// AUTH & SESSION
// ============================================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const code = operatorCodeInput.value.trim().toUpperCase()
    if (!code) return

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
    if (currentBusiness.logo_url) {
        document.getElementById('sidebarBizLogo').innerHTML = `<img src="${currentBusiness.logo_url}" alt="Logo">`
    }

    renderPermissions(operator.permissions)
    
    // Data load
    loadOrders()
    startRealtime()
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
    const activeStatuses = ['pending', 'verified', 'for_delivery', 'dispatched']
    
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_token, customer_name, customer_address, total_amount, status, order_type, order_notes, created_at')
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

function renderOrders(orders) {
    ordersGrid.innerHTML = ''
    orderCountEl.textContent = orders.length

    if (orders.length === 0) {
        ordersGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                <i class="ri-file-list-line" style="font-size: 3rem; opacity: 0.3;"></i>
                <p style="margin-top: 1rem; font-weight: 600;">No hay pedidos activos en este momento.</p>
            </div>`
        return
    }

    orders.forEach(order => {
        const card = document.createElement('div')
        card.className = 'order-card'
        
        const ref = order.order_token ? order.order_token.split('-')[0] : order.id.slice(0,5)
        const itemsSummary = order.order_notes || order.customer_address || 'Sin detalles adicionales'

        card.innerHTML = `
            <div class="card-header">
                <span class="order-id">#${ref}</span>
                <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
            </div>
            <div class="customer-name">${order.customer_name}</div>
            <div class="order-items">${itemsSummary}</div>
            <div class="order-total">$${parseFloat(order.total_amount).toLocaleString('es-CO')}</div>
            <div class="card-actions" id="actions-${order.id}"></div>
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

    let nextStatus = null
    let btnText = ''

    if (order.status === 'pending') {
        nextStatus = 'verified'; btnText = 'Verificar Pedido';
    } else if (order.status === 'verified' || order.status === 'for_delivery') {
        nextStatus = 'dispatched'; btnText = 'Despachar';
    } else if (order.status === 'dispatched') {
        nextStatus = 'completed'; btnText = 'Marcar Completado';
    }

    if (nextStatus) {
        const btn = document.createElement('button')
        btn.className = 'btn-action'
        btn.textContent = btnText
        btn.onclick = () => changeOrderStatus(order.id, nextStatus)
        container.appendChild(btn)
    }
}

async function changeOrderStatus(orderId, newStatus) {
    if (!hasPermission('manage_orders')) {
        alert('No tienes permiso para gestionar pedidos.')
        return
    }

    try {
        await ordersService.updateStatus(orderId, newStatus)
        loadOrders() 
    } catch (error) {
        console.error('Error al actualizar pedido:', error)
        alert('Error al actualizar: ' + (error.message || 'Error desconocido'))
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

// Start
init()
