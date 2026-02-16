import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { adminUtils } from '../../../utils/admin-utils.js'
import { authService } from '../../../services/auth.js'
import { notify, confirm } from '../../../utils/notifications.js'
import { businessHoursService } from '../../../services/businessHours.js'
import { paymentMethodsService } from '../../../services/paymentMethods.js'

// State
let businessId = null
let currentBusiness = null
let businessHours = []
let paymentMethods = []

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const { isAdmin } = await authGuard.checkAdminSession()
    if (!isAdmin) {
        window.location.href = '/login'
        return
    }

    const user = await authService.getCurrentUser()
    if (user) document.getElementById('adminEmail').textContent = user.email

    // 2. Get ID from URL
    const params = new URLSearchParams(window.location.search)
    businessId = params.get('id')

    if (!businessId) {
        notify.error('ID de negocio no proporcionado')
        setTimeout(() => history.back(), 2000)
        return
    }

    // 3. Load Data
    await loadBusinessData()

    // 4. Listeners
    setupListeners()
    initTabs()
})

async function loadBusinessData() {
    const loadingToast = notify.loading('Cargando datos del negocio...')

    try {
        const { success, data, error } = await adminService.getBusinessById(businessId)

        if (!success) {
            notify.updateLoading(loadingToast, 'Error al cargar negocio: ' + error, 'error')
            return
        }

        currentBusiness = data
        renderData()
        notify.remove(loadingToast)

    } catch (err) {
        console.error(err)
        notify.updateLoading(loadingToast, 'Error inesperado', 'error')
    }
}

function renderData() {
    if (!currentBusiness) return

    const b = currentBusiness

    // Header
    document.getElementById('businessName').textContent = b.name
    updateHeaderBadge(b)

    // General Info
    document.getElementById('inputName').value = b.name || ''
    document.getElementById('inputDescription').value = b.description || ''
    document.getElementById('inputPhone').value = b.whatsapp_number || b.phone || ''

    // Address
    document.getElementById('inputAddress').value = b.address || ''

    // Logo
    updateLogoPreview(b.logo_url)

    // Metrics
    document.getElementById('metricRegistered').textContent = adminUtils.formatDate(b.created_at)
    document.getElementById('metricProducts').textContent = b.products_count || 0
    document.getElementById('metricOrders').textContent = b.orders_count || 0
    document.getElementById('metricLastAccess').textContent = 'N/A'

    // Status & Plan
    document.getElementById('selectStatus').value = b.is_active ? 'active' : 'inactive'

    const validPlans = ['plus', 'pro']
    const currentPlan = b.plan_type || 'plus'
    document.getElementById('selectPlan').value = validPlans.includes(currentPlan) ? currentPlan : 'plus'

    // Plan Expiry Logic (formerly Trial Logic)
    togglePlanInputs(b.plan_type || 'plus')
    if (b.plan_expires_at) {
        document.getElementById('inputTrialEnd').value = b.plan_expires_at.split('T')[0]
        updateTrialDaysDisplay(b.plan_expires_at)
    }

    // Admin Notes
    document.getElementById('adminNotes').value = b.admin_notes || ''
}

function updateHeaderBadge(b) {
    const container = document.getElementById('headerStatusBadge')
    let html = ''

    if (!b.is_active) {
        html = '<span class="badge paused" style="font-size: 1rem; padding: 0.25rem 0.75rem;">Inactivo</span>'
    } else {
        // Show days remaining for active plans (Plus)
        const days = adminUtils.getDaysRemaining(b.plan_expires_at)

        if (b.plan_type === 'pro') {
            html = `<span class="badge active" style="font-size: 1rem; padding: 0.25rem 0.75rem; background-color: #dcfce7; color: #166534;">PRO</span>`
        } else {
            // Plus / Default
            if (days < 0) {
                html = `<span class="badge paused" style="font-size: 1rem; padding: 0.25rem 0.75rem; background-color: #fee2e2; color: #991b1b;">Vencido (${Math.abs(days)}d)</span>`
            } else {
                html = `<span class="badge active" style="font-size: 1rem; padding: 0.25rem 0.75rem;">Activo (${days}d)</span>`
            }
        }
    }

    container.innerHTML = html
}

function togglePlanInputs(planType) {
    const container = document.getElementById('trialInfoContainer')
    // Show expiry for both 'plus' and 'pro' as both have monthly periods
    if (planType === 'plus' || planType === 'pro') {
        container.style.display = 'block'
    } else {
        container.style.display = 'none'
    }
}

function updateTrialDaysDisplay(dateStr) {
    const days = adminUtils.getDaysRemaining(dateStr)
    const el = document.getElementById('trialDaysRemaining')

    if (days < 0) {
        el.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>Vencido hace ${Math.abs(days)} días</span>`
        el.style.color = '#dc2626'
        el.style.backgroundColor = '#fee2e2'
        el.style.borderColor = '#fca5a5'
    } else {
        el.innerHTML = `<i class="fa-solid fa-clock"></i> <span>${days} días restantes</span>`
        if (days < 3) {
            el.style.color = '#dc2626'
            el.style.backgroundColor = '#fffbeb' // maintain yellow bg?
            el.style.borderColor = '#fcd34d'
        } else {
            el.style.color = '#b45309'
            el.style.backgroundColor = '#fffbeb'
            el.style.borderColor = '#fcd34d'
        }
    }
}

function setupListeners() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authService.signOut()
        authGuard.clearAdminCache()
        window.location.href = '/login'
    })

    // 1. Save General Info
    document.getElementById('generalInfoForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        if (!(await confirm.show({ title: 'Actualizar Información', message: '¿Guardar los cambios en la información general?' }))) return

        const name = document.getElementById('inputName').value
        const phone = document.getElementById('inputPhone').value
        const description = document.getElementById('inputDescription').value
        const direccion = document.getElementById('inputAddress').value

        const loading = notify.loading('Guardando...')

        const updates = {
            name,
            whatsapp_number: phone,
            description,
            address: direccion
        }

        const { success, error } = await adminService.updateBusiness(businessId, updates)

        if (success) {
            await adminService.logAction(null, businessId, 'UPDATE_INFO', updates)
            notify.updateLoading(loading, 'Información actualizada')
            loadBusinessData()
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // 2. Update Status/Plan
    document.getElementById('statusPlanForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        const status = document.getElementById('selectStatus').value
        const plan = document.getElementById('selectPlan').value
        const planEnd = document.getElementById('inputTrialEnd').value

        const isActive = status === 'active'

        if (!(await confirm.show({
            title: 'Actualizar Estado/Plan',
            message: `¿Cambiar a ${status.toUpperCase()} y Plan ${plan.toUpperCase()}?`,
            type: 'warning'
        }))) return

        const loading = notify.loading('Actualizando...')

        const updates = {
            is_active: isActive,
            plan_type: plan
        }

        if ((plan === 'plus' || plan === 'pro') && planEnd) {
            updates.plan_expires_at = planEnd
        }

        const { success, error } = await adminService.updateBusiness(businessId, updates)

        if (success) {
            await adminService.logAction(null, businessId, 'UPDATE_STATUS_PLAN', updates)
            notify.updateLoading(loading, 'Estado actualizado')
            loadBusinessData()
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // Plan Select Change Listener
    document.getElementById('selectPlan').addEventListener('change', (e) => {
        togglePlanInputs(e.target.value)
    })

    // 3. Admin Notes
    document.getElementById('notesForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        const notes = document.getElementById('adminNotes').value
        const loading = notify.loading('Guardando notas...')

        const { success, error } = await adminService.updateBusiness(businessId, { admin_notes: notes })

        if (success) {
            notify.updateLoading(loading, 'Notas guardadas')
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // 4. Extend Plan (Fair Extension)
    document.getElementById('btnExtendTrial').addEventListener('click', async () => {
        if (!currentBusiness) return

        if (!(await confirm.show({
            title: 'Extender Plan',
            message: '¿Añadir 30 días al plan actual? (Se acumularán los pedidos no usados)',
            confirmText: 'Sí, extender',
            type: 'info'
        }))) return

        const loading = notify.loading('Extendiendo plan...')

        // Use new adminService method
        const { success, error } = await adminService.extendBusinessPlan(businessId)

        if (success) {
            notify.updateLoading(loading, 'Plan extendido exitosamente')
            loadBusinessData()
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // 5. Setup Catalog
    document.getElementById('btnSetupCatalog').addEventListener('click', () => {
        window.location.href = `/admin/setup-catalogo?negocio_id=${businessId}`
    })

    // 6. Logo Upload
    const logoInput = document.getElementById('logoInput')
    logoInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return

        const file = e.target.files[0]
        if (file.size > 2 * 1024 * 1024) {
            notify.error('La imagen no puede pesar más de 2MB')
            return
        }

        const loading = notify.loading('Subiendo logo...')
        const ext = file.name.split('.').pop()
        const path = `${businessId}/logo-${Date.now()}.${ext}`

        const { success, data, error } = await adminService.uploadLogo(path, file)

        if (success) {
            const { success: dbSuccess, error: dbError } = await adminService.updateBusiness(businessId, { logo_url: data.publicUrl })

            if (dbSuccess) {
                notify.updateLoading(loading, 'Logo actualizado')
                updateLogoPreview(data.publicUrl)
                currentBusiness.logo_url = data.publicUrl
                await adminService.logAction(null, businessId, 'UPDATE_LOGO', { url: data.publicUrl })
            } else {
                notify.updateLoading(loading, 'Error guardando URL: ' + dbError, 'error')
            }
        } else {
            notify.updateLoading(loading, 'Error subiendo imagen: ' + error, 'error')
        }
    })

    // 7. Save Hours
    const btnSaveHours = document.getElementById('btnSaveHours')
    if (btnSaveHours) {
        btnSaveHours.addEventListener('click', async () => {
            const loading = notify.loading('Guardando horarios...')
            try {
                // Sanitize data locally to avoid sending created_at/updated_at/etc
                const hoursPayload = businessHours.map(h => ({
                    business_id: h.business_id, // Should already correspond to current business
                    day_of_week: h.day_of_week,
                    is_open: h.is_open,
                    open_time: h.open_time,
                    close_time: h.close_time,
                    ...(h.id ? { id: h.id } : {}) // Keep ID if exists
                }))

                await businessHoursService.upsert(hoursPayload)
                notify.updateLoading(loading, 'Horarios guardados')
                // Reload to get fresh data (IDs, formatted times)
                loadBusinessHours()
            } catch (error) {
                console.error(error)
                notify.updateLoading(loading, 'Error al guardar', 'error')
            }
        })
    }

    // 8. Add Payment Method
    const btnAddPayment = document.getElementById('btnAddPaymentMethod')
    if (btnAddPayment) {
        btnAddPayment.addEventListener('click', () => openPaymentModal())
    }

    // Modal Listeners
    const closePmModalBtn = document.getElementById('closePmModalBtn')
    const cancelPmBtn = document.getElementById('cancelPmBtn')
    const pmForm = document.getElementById('paymentMethodForm')
    const modalOverlay = document.getElementById('paymentMethodModal')

    if (closePmModalBtn) closePmModalBtn.addEventListener('click', closePaymentModal)
    if (cancelPmBtn) cancelPmBtn.addEventListener('click', closePaymentModal)
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closePaymentModal()
        })
    }
    if (pmForm) pmForm.addEventListener('submit', handlePaymentModalSubmit)
}

function updateLogoPreview(url) {
    const img = document.getElementById('logoPreview')
    const placeholder = document.getElementById('logoPlaceholder')

    if (url) {
        img.src = url
        img.style.display = 'block'
        placeholder.style.display = 'none'
    } else {
        img.style.display = 'none'
        placeholder.style.display = 'block'
    }
}

// ============================================
// TABS LOGIC
// ============================================
function initTabs() {
    const tabs = document.querySelectorAll('.tab-item')
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'))
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))

            // Add active to clicked
            tab.classList.add('active')
            const tabId = tab.dataset.tab
            document.getElementById(`tab-${tabId}`).classList.add('active')

            // Load data if needed
            if (tabId === 'hours' && businessHours.length === 0) loadBusinessHours()
            if (tabId === 'payment' && paymentMethods.length === 0) loadPaymentMethods()
        })
    })
}

// ============================================
// HOURS LOGIC
// ============================================
async function loadBusinessHours() {
    const container = document.getElementById('hoursContainer')
    container.innerHTML = '<p style="text-align:center; padding: 2rem;">Cargando...</p>'

    try {
        const data = await businessHoursService.getByBusiness(businessId)
        // Ensure all 7 days exist
        const days = [0, 1, 2, 3, 4, 5, 6] // 0=Sunday
        businessHours = days.map(day => {
            const existing = data.find(d => d.day_of_week === day)
            return existing || {
                business_id: businessId,
                day_of_week: day,
                is_open: true,
                open_time: '09:00',
                close_time: '21:00'
            }
        })

        renderBusinessHours()
    } catch (error) {
        console.error(error)
        container.innerHTML = '<p class="error-msg">Error al cargar horarios</p>'
    }
}

function renderBusinessHours() {
    const container = document.getElementById('hoursContainer')
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

    container.innerHTML = businessHours.map((h, index) => `
        <div class="hours-row" data-day="${h.day_of_week}">
            <div style="font-weight: 600;">${dayNames[h.day_of_week]}</div>
            
            <div class="toggle-wrapper">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" class="hour-toggle" ${h.is_open ? 'checked' : ''} data-index="${index}">
                    <span style="font-size: 0.875rem;">${h.is_open ? 'Abierto' : 'Cerrado'}</span>
                </label>
            </div>

            <div class="time-inputs" style="display: ${h.is_open ? 'flex' : 'none'}; gap: 0.5rem; align-items: center;">
                <input type="time" class="form-input hour-start" value="${h.open_time ? h.open_time.slice(0, 5) : '09:00'}" data-index="${index}">
                <span>a</span>
                <input type="time" class="form-input hour-end" value="${h.close_time ? h.close_time.slice(0, 5) : '21:00'}" data-index="${index}">
            </div>
            
            <div style="${!h.is_open ? 'display: block;' : 'display: none;'} color: var(--text-secondary); font-size: 0.875rem;">
                No disponible
            </div>
        </div>
    `).join('')

    // Add listeners using delegation or direct attach
    container.querySelectorAll('.hour-toggle').forEach(el => {
        el.addEventListener('change', (e) => {
            const index = e.target.dataset.index
            businessHours[index].is_open = e.target.checked
            renderBusinessHours() // Re-render to show/hide inputs
        })
    })

    container.querySelectorAll('.hour-start').forEach(el => {
        el.addEventListener('change', (e) => {
            businessHours[e.target.dataset.index].open_time = e.target.value
        })
    })

    container.querySelectorAll('.hour-end').forEach(el => {
        el.addEventListener('change', (e) => {
            businessHours[e.target.dataset.index].close_time = e.target.value
        })
    })
}

// ============================================
// PAYMENT METHODS LOGIC
// ============================================
async function loadPaymentMethods() {
    const container = document.getElementById('paymentMethodsList')
    container.innerHTML = '<p style="text-align:center; padding: 2rem;">Cargando...</p>'

    try {
        paymentMethods = await paymentMethodsService.getByBusiness(businessId)
        renderPaymentMethods()
    } catch (error) {
        console.error(error)
        container.innerHTML = '<p class="error-msg">Error al cargar métodos de pago</p>'
    }
}

function renderPaymentMethods() {
    const container = document.getElementById('paymentMethodsList')

    if (paymentMethods.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 2rem;">No hay métodos de pago configurados.</p>'
        return
    }

    container.innerHTML = paymentMethods.map(pm => `
        <div class="payment-item">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-weight: 500;">${pm.name}</div>
                <div style="font-size: 0.75rem; color: ${pm.is_active ? '#16a34a' : '#dc2626'};">
                    ${pm.is_active ? 'Activo' : 'Inactivo'}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn-secondary btn-sm toggle-pm" data-id="${pm.id}" title="${pm.is_active ? 'Desactivar' : 'Activar'}">
                    <i class="fa-solid ${pm.is_active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                </button>
                <button class="btn-secondary btn-sm edit-pm" data-id="${pm.id}" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-secondary btn-sm delete-pm" data-id="${pm.id}" style="color: #dc2626; border-color: #fee2e2; background: #fef2f2;" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('')

    // Listeners
    container.querySelectorAll('.toggle-pm').forEach(btn => {
        btn.addEventListener('click', () => togglePaymentMethod(btn.dataset.id))
    })

    container.querySelectorAll('.edit-pm').forEach(btn => {
        btn.addEventListener('click', () => editPaymentMethod(btn.dataset.id))
    })

    container.querySelectorAll('.delete-pm').forEach(btn => {
        btn.addEventListener('click', () => deletePaymentMethod(btn.dataset.id))
    })
}

// Payment Actions
async function togglePaymentMethod(id) {
    const pm = paymentMethods.find(p => p.id === id)
    if (!pm) return

    const newState = !pm.is_active
    const loading = notify.loading('Actualizando...')

    try {
        const updated = await paymentMethodsService.update(id, { is_active: newState })

        // Update local state
        const index = paymentMethods.findIndex(p => p.id === id)
        if (index !== -1) paymentMethods[index] = updated

        notify.updateLoading(loading, 'Estado actualizado')
        renderPaymentMethods()
    } catch (error) {
        notify.updateLoading(loading, 'Error al actualizar', 'error')
    }
}

async function editPaymentMethod(id) {
    const pm = paymentMethods.find(p => p.id === id)
    if (!pm) return
    openPaymentModal(pm)
}

function openPaymentModal(paymentMethod = null) {
    const modal = document.getElementById('paymentMethodModal')
    const title = document.getElementById('pmModalTitle')
    const idInput = document.getElementById('pmId')
    const nameInput = document.getElementById('pmName')
    const activeInput = document.getElementById('pmIsActive')

    if (paymentMethod) {
        title.textContent = 'Editar Método de Pago'
        idInput.value = paymentMethod.id
        nameInput.value = paymentMethod.name
        activeInput.checked = paymentMethod.is_active
    } else {
        title.textContent = 'Agregar Método de Pago'
        idInput.value = ''
        nameInput.value = ''
        activeInput.checked = true
    }

    modal.style.display = 'flex'
    nameInput.focus()
}

function closePaymentModal() {
    document.getElementById('paymentMethodModal').style.display = 'none'
}

async function handlePaymentModalSubmit(e) {
    e.preventDefault()

    const id = document.getElementById('pmId').value
    const name = document.getElementById('pmName').value
    const isActive = document.getElementById('pmIsActive').checked

    if (!name.trim()) return

    const loading = notify.loading(id ? 'Actualizando...' : 'Creando...')
    closePaymentModal()

    try {
        if (id) {
            // Edit
            const updated = await paymentMethodsService.update(id, {
                name: name.trim(),
                is_active: isActive
            })

            const index = paymentMethods.findIndex(p => p.id === id)
            if (index !== -1) paymentMethods[index] = updated

            notify.updateLoading(loading, 'Actualizado correctamente')
        } else {
            // Create
            const maxOrder = paymentMethods.reduce((max, p) => Math.max(max, p.display_order || 0), 0)

            const newPm = await paymentMethodsService.create({
                business_id: businessId,
                name: name.trim(),
                is_active: isActive,
                display_order: maxOrder + 1
            })

            paymentMethods.push(newPm)
            notify.updateLoading(loading, 'Método creado')
        }

        renderPaymentMethods()
    } catch (error) {
        console.error(error)
        notify.updateLoading(loading, 'Error: ' + error.message, 'error')
    }
}

async function deletePaymentMethod(id) {
    if (!(await confirm.show({
        title: 'Eliminar Método',
        message: '¿Estás seguro de eliminar este método de pago?',
        type: 'danger',
        confirmText: 'Sí, eliminar'
    }))) return

    const loading = notify.loading('Eliminando...')

    try {
        await paymentMethodsService.delete(id)

        // Update local state
        paymentMethods = paymentMethods.filter(p => p.id !== id)

        notify.updateLoading(loading, 'Eliminado correctamente')
        renderPaymentMethods()
    } catch (error) {
        notify.updateLoading(loading, 'Error al eliminar', 'error')
    }
}
