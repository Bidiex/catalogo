import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { adminUtils } from '../../../utils/admin-utils.js'
import { authService } from '../../../services/auth.js'
import { notify, confirm } from '../../../utils/notifications.js'

// State
let businessId = null
let currentBusiness = null

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const { isAdmin, userId: adminId } = await authGuard.checkAdminSession()
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
    document.getElementById('inputEmail').value = b.email || '' // Readonly
    document.getElementById('inputPhone').value = b.phone || ''

    // Metrics
    document.getElementById('metricRegistered').textContent = adminUtils.formatDate(b.created_at)
    document.getElementById('metricProducts').textContent = b.products_count || 0 // Assuming view/join returns this
    document.getElementById('metricOrders').textContent = b.orders_count || 0     // Assuming view/join returns this
    document.getElementById('metricLastAccess').textContent = 'N/A' // Need auth_logs implementation for real data

    // Status & Plan
    document.getElementById('selectStatus').value = b.is_active ? 'active' : 'inactive'
    document.getElementById('selectPlan').value = b.plan_type || 'trial'

    // Trial Logic
    toggleTrialInputs(b.plan_type || 'trial')
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
    } else if (b.plan_type === 'trial') {
        const days = adminUtils.getDaysRemaining(b.plan_expires_at)
        html = `<span class="badge trial" style="font-size: 1rem; padding: 0.25rem 0.75rem;">Trial (${days}d)</span>`
    } else {
        html = `<span class="badge active" style="font-size: 1rem; padding: 0.25rem 0.75rem;">Active ${b.plan_type}</span>`
    }

    container.innerHTML = html
}

function toggleTrialInputs(planType) {
    const container = document.getElementById('trialInfoContainer')
    if (planType === 'trial') {
        container.style.display = 'block'
    } else {
        container.style.display = 'none'
    }
}

function updateTrialDaysDisplay(dateStr) {
    const days = adminUtils.getDaysRemaining(dateStr)
    const el = document.getElementById('trialDaysRemaining')
    el.innerHTML = `<i class="fa-solid fa-clock"></i> <span>${days} días restantes</span>`
    if (days < 3) el.style.color = '#dc2626'; // Red warning
    else el.style.color = '#b45309';
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

        const loading = notify.loading('Guardando...')

        const { success, error } = await adminService.updateBusiness(businessId, { name, phone })

        if (success) {
            await adminService.logAction(null, businessId, 'UPDATE_INFO', { name, phone })
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
        const trialEnd = document.getElementById('inputTrialEnd').value

        const isActive = status === 'active'

        if (!(await confirm.show({
            title: 'Actualizar Estado/Plan',
            message: `¿Cambiar a ${status.toUpperCase()} y Plan ${plan.toUpperCase()}?`,
            type: 'warning'
        }))) return

        const loading = notify.loading('Actualizando...')

        const updates = {
            is_active: isActive,
            plan_type: plan,
            plan_expires_at: plan === 'trial' ? trialEnd : null // Clear expiry if not trial? Or keep it? keeping simplistic for now
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

    // Plan Select Change Listener to toggle date picker
    document.getElementById('selectPlan').addEventListener('change', (e) => {
        toggleTrialInputs(e.target.value)
    })

    // 3. Admin Notes
    document.getElementById('notesForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        const notes = document.getElementById('adminNotes').value
        const loading = notify.loading('Guardando notas...')

        // Note: Assuming 'admin_notes' column exists on businesses table.
        const { success, error } = await adminService.updateBusiness(businessId, { admin_notes: notes })

        if (success) {
            notify.updateLoading(loading, 'Notas guardadas')
            // No log for notes? Or maybe yes? User said "NO registrar en log (son privadas)"
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // 4. Extend Trial
    document.getElementById('btnExtendTrial').addEventListener('click', async () => {
        if (!currentBusiness) return

        if (!(await confirm.show({
            title: 'Extender Trial',
            message: '¿Añadir 30 días al periodo de trial actual?',
            confirmText: 'Sí, extender',
            type: 'info'
        }))) return

        const loading = notify.loading('Extendiendo trial...')

        // Calculate new date
        let baseDate = new Date()
        if (currentBusiness.plan_expires_at && new Date(currentBusiness.plan_expires_at) > baseDate) {
            baseDate = new Date(currentBusiness.plan_expires_at)
        }

        baseDate.setDate(baseDate.getDate() + 30) // Add 30 days
        const newDateStr = baseDate.toISOString()

        // Force plan to trial and active if extending? usually yes.
        const updates = {
            plan_type: 'trial',
            is_active: true,
            plan_expires_at: newDateStr
        }

        const { success, error } = await adminService.updateBusiness(businessId, updates)

        if (success) {
            await adminService.logAction(null, businessId, 'EXTEND_TRIAL', { added_days: 30, new_date: newDateStr })
            notify.updateLoading(loading, 'Trial extendido exitosamente')
            loadBusinessData()
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // 5. Setup Catalog
    document.getElementById('btnSetupCatalog').addEventListener('click', () => {
        window.location.href = `/admin/setup-catalogo?negocio_id=${businessId}`
    })
}
