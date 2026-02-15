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
