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
    document.querySelector('.sidebar-brand').setAttribute('data-operator', operator.name)
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

        const orderType = order.order_type === 'retiro' ? 'Retiro' : 'Domicilio'
        const orderTypeClass = order.order_type === 'retiro' ? 'retiro' : ''

        card.innerHTML = `
            <div class="card-top">
                <span class="order-ref">#${ref}</span>
                <span class="order-type-badge ${orderTypeClass}">${orderType}</span>
                <span class="status-badge status-${order.status}">${formatStatus(order.status)}</span>
            </div>
            <div class="customer-name">${order.customer_name}</div>
            ${order.customer_phone ? `<div class="customer-phone"><i class="ri-phone-line"></i>${order.customer_phone}</div>` : ''}
            ${order.customer_address ? `<div class="order-address"><i class="ri-map-pin-line"></i>${order.customer_address}</div>` : ''}
            <div class="card-divider"></div>
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

    const isPro = currentBusiness?.plan_type === 'pro'
    const isDelivery = order.order_type !== 'retiro'

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

async function confirmStatusChange(orderId, newStatus, title, message) {
    const confirmed = window.confirm(`${title}\n${message}`)
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

    const confirmed = window.confirm(`¿Asignar a ${name} y despachar el pedido?`)
    if (!confirmed) return

    try {
        await ordersService.assignDeliveryPerson(orderId, deliveryPersonId)
        const m = document.getElementById('opAssignModal')
        m.classList.add('hidden')
        m.style.display = 'none'
        window._assigningOrderId = null
        loadOrders()
    } catch (error) {
        alert('Error al asignar domiciliario: ' + error.message)
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
