// =============================================================================
// DELIVERY.JS — UI de Domiciliarios
// TraeGo · /d/{slug}
// Sin frameworks, ES Modules, Supabase Anon Key
// =============================================================================

import { supabase } from '../../config/supabase.js'

// ============================================================
// STATE
// ============================================================
let currentBusiness = null
let currentDeliveryPerson = null
let pendingOrders = []
let myOrders = []
let pendingSubscription = null
let myOrdersSubscription = null

const SESSION_KEY = 'traego_delivery_session'

// ============================================================
// DOM REFERENCES
// ============================================================
const loadingScreen = document.getElementById('loadingScreen')
const notFoundScreen = document.getElementById('notFoundScreen')
const loginScreen = document.getElementById('loginScreen')
const appScreen = document.getElementById('appScreen')

const loginForm = document.getElementById('loginForm')
const deliveryCodeInput = document.getElementById('deliveryCode')
const otpInputs = document.querySelectorAll('.otp-char')
const loginBtn = document.getElementById('loginBtn')
const loginSpinner = document.getElementById('loginSpinner')
const codeError = document.getElementById('codeError')
const loginBusinessName = document.getElementById('loginBusinessName')
const loginBusinessLogo = document.getElementById('loginBusinessLogo')

// Setup OTP logic
otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        let val = e.data || input.value;
        if (val) {
            input.value = val.charAt(val.length - 1).toUpperCase();
        }
        updateHiddenCode();
        if (input.value && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            if (!input.value && index > 0) {
                e.preventDefault();
                otpInputs[index - 1].focus();
                otpInputs[index - 1].value = '';
                updateHiddenCode();
            } else {
                updateHiddenCode();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            otpInputs[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
            e.preventDefault();
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().toUpperCase();
        const cleanData = pasteData.replace(/^DP-?/, '');
        let arr = cleanData.split('');
        otpInputs.forEach((inp, i) => {
            if (arr[i]) {
                inp.value = arr[i];
            }
        });
        updateHiddenCode();
        const nextEmpty = Array.from(otpInputs).findIndex(inp => !inp.value);
        if (nextEmpty !== -1) {
            otpInputs[nextEmpty].focus();
        } else {
            otpInputs[otpInputs.length - 1].focus();
        }
    });
});

function updateHiddenCode() {
    const codeStr = Array.from(otpInputs).map(i => i.value).join('');
    if (codeStr.length === 6) {
        deliveryCodeInput.value = 'DP-' + codeStr;
    } else {
        deliveryCodeInput.value = '';
    }
}

const appBusinessName = document.getElementById('appBusinessName')
const appDeliveryPerson = document.getElementById('appDeliveryPerson')
const appBusinessLogo = document.getElementById('appBusinessLogo')
const logoutBtn = document.getElementById('logoutBtn')

const pendingOrdersList = document.getElementById('pendingOrdersList')
const pendingEmpty = document.getElementById('pendingEmpty')
const pendingOrdersBadge = document.getElementById('pendingOrdersBadge')
const myOrdersList = document.getElementById('myOrdersList')
const mineEmpty = document.getElementById('mineEmpty')
const completedOrdersList = document.getElementById('completedOrdersList')
const completedEmpty = document.getElementById('completedEmpty')

const metricCompleted = document.getElementById('metricCompleted')
const metricAvgTime = document.getElementById('metricAvgTime')
const pendingBadge = document.getElementById('pendingBadge')
const mineBadge = document.getElementById('mineBadge')

// ============================================================
// BOOT
// ============================================================
async function init() {
    const slug = getSlugFromUrl()
    if (!slug) return showNotFound()

    const business = await resolveBusiness(slug)
    if (!business) return showNotFound()

    currentBusiness = business
    renderBusinessInfo(business)

    // Try to restore session
    const saved = loadSession()
    if (saved && saved.businessId === business.id) {
        const dp = await validateDeliveryPerson(saved.uniqueCode, business.id)
        if (dp) {
            currentDeliveryPerson = dp
            showApp()
            return
        }
    }

    showLogin()
}

function getSlugFromUrl() {
    // Path: /d/{slug}
    const parts = window.location.pathname.split('/')
    // parts[0]='', parts[1]='d', parts[2]=slug
    const idx = parts.indexOf('d')
    if (idx !== -1 && parts[idx + 1]) {
        return parts[idx + 1]
    }
    return null
}

async function resolveBusiness(slug) {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('id, name, logo_url, slug, primary_color')
            .eq('slug', slug)
            .single()

        if (error || !data) return null
        return data
    } catch {
        return null
    }
}

async function validateDeliveryPerson(uniqueCode, businessId) {
    try {
        const { data, error } = await supabase
            .from('delivery_persons')
            .select('id, name, vehicle_type, unique_code, is_active')
            .eq('unique_code', uniqueCode.trim().toUpperCase())
            .eq('business_id', businessId)
            .eq('is_active', true)
            .single()

        if (error || !data) return null
        return data
    } catch {
        return null
    }
}

// ============================================================
// UI STATES
// ============================================================
function showNotFound() {
    loadingScreen.classList.add('hidden')
    notFoundScreen.classList.remove('hidden')
}

function showLogin() {
    loadingScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    setTimeout(() => {
        if (otpInputs && otpInputs.length > 0) {
            otpInputs[0].focus()
        } else {
            deliveryCodeInput.focus()
        }
    }, 100)
}

function showApp() {
    loadingScreen.classList.add('hidden')
    loginScreen.classList.add('hidden')
    appScreen.classList.remove('hidden')
    appBusinessName.textContent = currentBusiness.name
    appDeliveryPerson.textContent = 'Hola, ' + (currentDeliveryPerson.name.split(' ')[0])
    renderAppLogo(appBusinessLogo)

    // Load all data
    loadPendingOrders()
    loadMyOrders()
    loadMetrics('today')

    // Start realtime
    startRealtimeSubscriptions()
}

function renderBusinessInfo(business) {
    // Used in login screen
    if (loginBusinessName) loginBusinessName.textContent = business.name
    if (business.logo_url) {
        renderLogoInEl(loginBusinessLogo, business.logo_url)
    }
    // Apply brand color from business settings
    applyBrandColor(business.primary_color)
}

function applyBrandColor(primaryColor) {
    const color = primaryColor || '#4CED17'
    // Darken by ~10% for hover state (simple luminance shift)
    const hover = adjustColor(color, -15)
    // Decide text contrast: dark text on light/bright colors
    const textColor = isLightColor(color) ? '#1a2a10' : '#ffffff'

    document.documentElement.style.setProperty('--color-primary', color)
    document.documentElement.style.setProperty('--color-primary-hover', hover)
    document.documentElement.style.setProperty('--color-primary-text', textColor)
    document.documentElement.style.setProperty('--color-primary-light', hexToLightBg(color))
}

function isLightColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    // Perceived luminance formula
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160
}

function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16)
    let g = parseInt(hex.slice(3, 5), 16)
    let b = parseInt(hex.slice(5, 7), 16)
    r = Math.max(0, Math.min(255, r + amount))
    g = Math.max(0, Math.min(255, g + amount))
    b = Math.max(0, Math.min(255, b + amount))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function hexToLightBg(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},0.12)`
}

function renderAppLogo(el) {
    if (currentBusiness.logo_url) {
        renderLogoInEl(el, currentBusiness.logo_url)
    }
}

function renderLogoInEl(el, logoUrl) {
    el.innerHTML = ''
    const img = document.createElement('img')
    img.src = logoUrl
    img.alt = 'Logo'
    el.appendChild(img)
}

// ============================================================
// SESSION
// ============================================================
function saveSession(uniqueCode, businessId) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ uniqueCode, businessId }))
}

function loadSession() {
    try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY))
    } catch {
        return null
    }
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY)
}

// ============================================================
// LOGIN
// ============================================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const code = deliveryCodeInput.value.trim()
    if (!code) {
        showCodeError('Ingresa tu código de acceso')
        return
    }

    setLoginLoading(true)
    clearCodeError()

    const dp = await validateDeliveryPerson(code, currentBusiness.id)

    if (!dp) {
        setLoginLoading(false)
        showCodeError('Código inválido o domiciliario inactivo. Revisa el código e intenta de nuevo.')
        if (otpInputs && otpInputs.length > 0) {
            otpInputs.forEach(i => i.value = '')
            updateHiddenCode()
            otpInputs[0].focus()
        } else {
            deliveryCodeInput.select()
        }
        return
    }

    currentDeliveryPerson = dp
    saveSession(dp.unique_code, currentBusiness.id)
    setLoginLoading(false)
    showApp()
})

logoutBtn.addEventListener('click', () => {
    // Stop realtime
    stopRealtimeSubscriptions()
    clearSession()
    currentDeliveryPerson = null

    appScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    deliveryCodeInput.value = ''
    if (otpInputs) otpInputs.forEach(i => i.value = '')
    clearCodeError()
    setTimeout(() => {
        if (otpInputs && otpInputs.length > 0) {
            otpInputs[0].focus()
        } else {
            deliveryCodeInput.focus()
        }
    }, 100)
})

function setLoginLoading(loading) {
    if (loading) {
        loginBtn.disabled = true
        loginBtn.querySelector('.btn-text').classList.add('hidden')
        loginSpinner.classList.remove('hidden')
    } else {
        loginBtn.disabled = false
        loginBtn.querySelector('.btn-text').classList.remove('hidden')
        loginSpinner.classList.add('hidden')
    }
}

function showCodeError(msg) {
    codeError.textContent = msg
    codeError.classList.remove('hidden')
}

function clearCodeError() {
    codeError.textContent = ''
    codeError.classList.add('hidden')
}

// ============================================================
// BOTTOM NAV
// ============================================================
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section
        switchSection(section)
    })
})

function switchSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'))
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))

    document.getElementById(`section-${sectionId}`)?.classList.add('active')
    document.querySelector(`.nav-btn[data-section="${sectionId}"]`)?.classList.add('active')

    if (sectionId === 'metrics') {
        loadMetrics('today')
    }
}

// ============================================================
// SECTION A: Pedidos disponibles (ready, sin asignar)
// ============================================================
async function loadPendingOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_token, customer_name, customer_address, customer_neighborhood, customer_phone, total_amount, ready_at, created_at, status')
            .eq('business_id', currentBusiness.id)
            .eq('status', 'ready')
            .is('delivery_person_id', null)
            .order('ready_at', { ascending: true })

        if (error) throw error

        pendingOrders = data || []
        renderPendingOrders()
    } catch (err) {
        console.error('loadPendingOrders error:', err)
    }
}

function renderPendingOrders() {
    // Clear only order cards, keep the empty state element
    const cards = pendingOrdersList.querySelectorAll('.order-card')
    cards.forEach(c => c.remove())

    updateBadge(pendingBadge, pendingOrders.length)

    if (pendingOrders.length === 0) {
        pendingEmpty.classList.remove('hidden')
        pendingOrdersBadge.classList.add('hidden')
        return
    }

    pendingEmpty.classList.add('hidden')
    pendingOrdersBadge.textContent = `${pendingOrders.length} ${pendingOrders.length === 1 ? 'nuevo' : 'nuevos'}`
    pendingOrdersBadge.classList.remove('hidden')

    pendingOrders.forEach(order => {
        const card = buildOrderCard(order, 'pending')
        pendingOrdersList.appendChild(card)
    })
}

// ============================================================
// SECTION B: Mis pedidos activos (dispatched, asignado a mí)
// ============================================================
async function loadMyOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_token, customer_name, customer_address, customer_neighborhood, customer_phone, total_amount, dispatched_at, created_at, status')
            .eq('business_id', currentBusiness.id)
            .eq('delivery_person_id', currentDeliveryPerson.id)
            .eq('status', 'dispatched')
            .order('dispatched_at', { ascending: true })

        if (error) throw error

        myOrders = data || []
        renderMyOrders()
    } catch (err) {
        console.error('loadMyOrders error:', err)
    }
}

function renderMyOrders() {
    const cards = myOrdersList.querySelectorAll('.order-card')
    cards.forEach(c => c.remove())

    updateBadge(mineBadge, myOrders.length)

    if (myOrders.length === 0) {
        mineEmpty.classList.remove('hidden')
        return
    }

    mineEmpty.classList.add('hidden')

    myOrders.forEach(order => {
        const card = buildOrderCard(order, 'mine')
        myOrdersList.appendChild(card)
    })
}

// ============================================================
// ORDER CARD BUILDER
// ============================================================
function buildOrderCard(order, type) {
    const card = document.createElement('div')
    card.className = 'order-card'
    card.dataset.orderId = order.id

    const ref = order.order_token
        ? order.order_token.split('-')[0].toUpperCase()
        : order.id.slice(0, 8).toUpperCase()

    const ts = type === 'mine' ? order.dispatched_at : order.ready_at
    const elapsed = formatElapsed(ts || order.created_at)

    // Format elapsed time dynamically based on the amount of minutes for semantic colors
    let orderTime = new Date(ts || order.created_at)
    let diffMins = Math.floor((new Date() - orderTime) / 60000)
    let elapsedClass = 'elapsed-good'
    if (diffMins >= 20) {
        elapsedClass = 'elapsed-danger'
    } else if (diffMins >= 10) {
        elapsedClass = 'elapsed-amber'
    }

    // Check if order is pending and elapsed time > 20 mins to append delayed border
    if (type === 'pending' && diffMins > 20) {
        card.classList.add('delayed')
    }

    const header = document.createElement('div')
    header.className = 'order-card-header'
    header.innerHTML = `
    <div>
      <div class="order-ref">#${ref}</div>
      <div class="order-elapsed ${elapsedClass}"><i class="ri-time-line"></i> ${elapsed}</div>
    </div>
    ${type === 'pending'
            ? '<span class="order-status-badge ready"><i class="ri-shopping-bag-3-line"></i> Para llevar</span>'
            : '<span class="order-status-badge dispatched"><i class="ri-motorbike-fill"></i> En camino</span>'
        }
  `

    const body = document.createElement('div')
    body.className = 'order-card-body'

    const phone = order.customer_phone || ''
    const dpName = currentDeliveryPerson ? currentDeliveryPerson.name.split(' ')[0] : 'el domiciliario'
    const bizName = currentBusiness ? currentBusiness.name : 'el negocio'
    const waMsg = encodeURIComponent(`Hola soy ${dpName}, el domiciliario de ${bizName}, te contacto para `)
    const waNumber = phone.replace(/\D/g, '')
    const waLink = `https://wa.me/57${waNumber}?text=${waMsg}`

    const phoneRowHTML = type === 'mine' ? `
    <div class="order-info-row phone-row">
      <div class="phone-info">
        <span class="phone-number"><i class="ri-phone-line"></i> ${phone}</span>
        <div class="phone-actions">
          <a href="tel:${phone}" class="btn-phone-call">Llamar</a>
          <a href="${waLink}" target="_blank" rel="noopener" class="btn-phone-whatsapp">WhatsApp</a>
        </div>
      </div>
    </div>` : '';

    body.innerHTML = `
    <div class="order-info-row">
      <i class="ri-user-3-line"></i>
      <span>${order.customer_name}</span>
    </div>
    ${phoneRowHTML}
    <div class="order-info-row">
      <i class="ri-map-pin-2-line"></i>
      <span>${order.customer_address}${order.customer_neighborhood ? `, ${order.customer_neighborhood}` : ''}</span>
    </div>
    <div class="order-amount">$${parseFloat(order.total_amount).toLocaleString('es-CO')}</div>
  `

    const actions = document.createElement('div')
    actions.className = 'order-card-actions'

    if (type === 'pending') {
        const takeBtn = document.createElement('button')
        takeBtn.className = 'btn-primary-action'
        takeBtn.innerHTML = '<i class="ri-checkbox-circle-line"></i> Tomar pedido'
        takeBtn.addEventListener('click', () => handleTakeOrder(order.id, card, takeBtn))
        actions.appendChild(takeBtn)
    } else {
        const viewBtn = document.createElement('button')
        viewBtn.className = 'btn-secondary-action'
        viewBtn.innerHTML = '<i class="ri-map-pin-line"></i> Ver dirección'
        viewBtn.addEventListener('click', () => {
            const addr = encodeURIComponent(`${order.customer_address} ${order.customer_neighborhood || ''}`)
            window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank')
        })

        const completeBtn = document.createElement('button')
        completeBtn.className = 'btn-primary-action success'
        completeBtn.innerHTML = '<i class="ri-flag-line"></i> Entregado'
        completeBtn.addEventListener('click', () => handleCompleteOrder(order.id, card, completeBtn))

        actions.appendChild(viewBtn)
        actions.appendChild(completeBtn)
    }

    card.appendChild(header)
    card.appendChild(body)
    card.appendChild(actions)

    return card
}

// ============================================================
// ACTIONS
// ============================================================
async function handleTakeOrder(orderId, card, btn) {
    const confirmed = await showConfirm(
        '¿Tomar este pedido?',
        'El pedido quedará asignado a ti y pasará a "Mis Pedidos".'
    )
    if (!confirmed) return

    btn.disabled = true
    btn.innerHTML = '<div class="btn-spinner"></div>'

    try {
        const { data, error } = await supabase
            .from('orders')
            .update({
                status: 'dispatched',
                delivery_person_id: currentDeliveryPerson.id
            })
            .eq('id', orderId)
            .eq('status', 'ready')
            .is('delivery_person_id', null)
            .select('id')

        if (error) throw error

        const taken = data && data.length > 0

        if (!taken) {
            showToast('Este pedido ya fue tomado por otro domiciliario', 'info')
            btn.disabled = false
            btn.innerHTML = '<i class="ri-checkbox-circle-line"></i> Tomar pedido'
            return
        }

        showToast('¡Pedido tomado! Ahora está en "Mis Pedidos"', 'success')
        // Realtime will update both lists, but we can also trigger manually
        card.style.opacity = '0.5'
        card.style.pointerEvents = 'none'
    } catch (err) {
        console.error('handleTakeOrder error:', err)
        showToast('Error al tomar el pedido. Intenta de nuevo.', 'error')
        btn.disabled = false
        btn.innerHTML = '<i class="ri-checkbox-circle-line"></i> Tomar pedido'
    }
}

async function handleCompleteOrder(orderId, card, btn) {
    const confirmed = await showConfirm(
        '¿Marcar como entregado?',
        'Confirma que entregaste el pedido al cliente.'
    )
    if (!confirmed) return

    btn.disabled = true
    btn.innerHTML = '<div class="btn-spinner"></div>'

    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId)
            .eq('delivery_person_id', currentDeliveryPerson.id)
            .eq('status', 'dispatched')

        if (error) throw error

        showToast('¡Pedido entregado exitosamente!', 'success')
        card.style.opacity = '0.5'
        card.style.pointerEvents = 'none'
    } catch (err) {
        console.error('handleCompleteOrder error:', err)
        showToast('Error al completar el pedido. Intenta de nuevo.', 'error')
        btn.disabled = false
        btn.innerHTML = '<i class="ri-flag-line"></i> Entregado'
    }
}

// ============================================================
// SECTION C: MÉTRICAS
// ============================================================
document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'))
        pill.classList.add('active')
        loadMetrics(pill.dataset.range)
    })
})

async function loadMetrics(range) {
    try {
        const since = getRangeSince(range)

        const { data, error } = await supabase
            .from('orders')
            .select('id, dispatched_at, completed_at, status')
            .eq('business_id', currentBusiness.id)
            .eq('delivery_person_id', currentDeliveryPerson.id)
            .eq('status', 'completed')
            .gte('completed_at', since.toISOString())
            .order('completed_at', { ascending: false })

        if (error) throw error

        const completed = data || []

        // Count
        metricCompleted.textContent = completed.length

        // Avg delivery time (dispatched_at → completed_at)
        const timesWithData = completed.filter(o => o.dispatched_at && o.completed_at)
        if (timesWithData.length > 0) {
            const avgMs = timesWithData.reduce((sum, o) => {
                return sum + (new Date(o.completed_at) - new Date(o.dispatched_at))
            }, 0) / timesWithData.length

            const avgMin = Math.round(avgMs / 60000)
            metricAvgTime.textContent = avgMin < 60
                ? `${avgMin} min`
                : `${Math.floor(avgMin / 60)}h ${avgMin % 60}m`
        } else {
            metricAvgTime.textContent = '–'
        }

        renderCompletedHistory(completed)
    } catch (err) {
        console.error('loadMetrics error:', err)
    }
}

function renderCompletedHistory(orders) {
    const cards = completedOrdersList.querySelectorAll('.order-card')
    cards.forEach(c => c.remove())

    if (orders.length === 0) {
        completedEmpty.classList.remove('hidden')
        return
    }

    completedEmpty.classList.add('hidden')

    orders.slice(0, 20).forEach(order => {
        const card = buildOrderCardCompleted(order)
        completedOrdersList.appendChild(card)
    })
}

function getRangeSince(range) {
    const now = new Date()
    if (range === 'today') {
        const d = new Date(now)
        d.setHours(0, 0, 0, 0)
        return d
    }
    if (range === 'week') {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        return d
    }
    if (range === 'month') {
        const d = new Date(now)
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        return d
    }
    return new Date(0)
}

// Override buildOrderCard for completed history type
function buildOrderCardCompleted(order) {
    const card = document.createElement('div')
    card.className = 'order-card'

    const ref = order.order_token
        ? order.order_token.split('-')[0].toUpperCase()
        : order.id.slice(0, 8).toUpperCase()

    const when = order.completed_at
        ? new Date(order.completed_at).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '–'

    card.innerHTML = `
    <div class="order-card-header">
      <div>
        <div class="order-ref">#${ref}</div>
        <div class="order-elapsed">${when}</div>
      </div>
      <span class="order-status-badge completed"><i class="ri-flag-line"></i> Entregado</span>
    </div>
  `
    return card
}

// ============================================================
// REALTIME
// ============================================================
function startRealtimeSubscriptions() {
    stopRealtimeSubscriptions()

    // Channel: pedidos ready sin asignar
    pendingSubscription = supabase
        .channel(`delivery-pending-${currentBusiness.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `business_id=eq.${currentBusiness.id}`
        }, handleRealtimeEvent)
        .subscribe()
}

function handleRealtimeEvent(payload) {
    const order = payload.new || payload.old
    if (!order) return

    // Refresh both sections on any relevant change
    loadPendingOrders()
    loadMyOrders()
}

function stopRealtimeSubscriptions() {
    if (pendingSubscription) {
        supabase.removeChannel(pendingSubscription)
        pendingSubscription = null
    }
    if (myOrdersSubscription) {
        supabase.removeChannel(myOrdersSubscription)
        myOrdersSubscription = null
    }
}

// ============================================================
// BADGE HELPERS
// ============================================================
function updateBadge(badgeEl, count) {
    if (!badgeEl) return
    if (count > 0) {
        badgeEl.textContent = count > 99 ? '99+' : count
        badgeEl.classList.remove('hidden')
    } else {
        badgeEl.classList.add('hidden')
    }
}

// ============================================================
// CONFIRM MODAL
// ============================================================
const confirmModal = document.getElementById('confirmModal')
const confirmOverlay = document.getElementById('confirmOverlay')
const confirmIcon = document.getElementById('confirmIcon')
const confirmTitle = document.getElementById('confirmTitle')
const confirmMessage = document.getElementById('confirmMessage')
const confirmOk = document.getElementById('confirmOk')
const confirmCancel = document.getElementById('confirmCancel')

function showConfirm(title, message, type = 'info') {
    return new Promise((resolve) => {
        confirmTitle.textContent = title
        confirmMessage.textContent = message

        // Reset classes
        confirmIcon.className = 'confirm-icon'
        confirmOk.className = 'btn-confirm-ok'

        if (type === 'danger') {
            confirmIcon.classList.add('confirm-icon-warning')
            confirmIcon.innerHTML = '<i class="ri-error-warning-line"></i>'
            confirmOk.classList.add('danger')
        } else if (type === 'success') {
            confirmIcon.classList.add('confirm-icon-success')
            confirmIcon.innerHTML = '<i class="ri-checkbox-circle-line"></i>'
        } else {
            // info default
            confirmIcon.classList.add('confirm-icon-info')
            confirmIcon.innerHTML = '<i class="ri-information-line"></i>'
        }

        confirmModal.classList.remove('hidden')

        const cleanup = (result) => {
            confirmModal.classList.add('hidden')
            confirmOk.removeEventListener('click', onOk)
            confirmCancel.removeEventListener('click', onCancel)
            confirmOverlay.removeEventListener('click', onCancel)
            resolve(result)
        }

        const onOk = () => cleanup(true)
        const onCancel = () => cleanup(false)

        confirmOk.addEventListener('click', onOk)
        confirmCancel.addEventListener('click', onCancel)
        confirmOverlay.addEventListener('click', onCancel)
    })
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
const toastContainer = document.getElementById('toastContainer')

function showToast(message, type = 'info') {
    const toast = document.createElement('div')
    toast.className = `toast ${type}`

    const iconMap = { success: 'ri-checkbox-circle-line', error: 'ri-error-warning-line', info: 'ri-information-line' }
    toast.innerHTML = `<i class="${iconMap[type] || iconMap.info}"></i> ${message}`

    toastContainer.appendChild(toast)

    setTimeout(() => {
        toast.classList.add('removing')
        setTimeout(() => toast.remove(), 220)
    }, 3500)
}

// ============================================================
// TIME HELPERS
// ============================================================
function formatElapsed(isoDate) {
    if (!isoDate) return ''
    const now = new Date()
    const then = new Date(isoDate)
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Hace un momento'
    if (diffMin < 60) return `Hace ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    const remMin = diffMin % 60
    if (remMin === 0) return `Hace ${diffH}h`
    return `Hace ${diffH}h ${remMin}m`
}

// ============================================================
// BOOT
// ============================================================
init()
