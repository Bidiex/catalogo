import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { adminUtils } from '../../../utils/admin-utils.js'
import { authService } from '../../../services/auth.js'
import { notify, confirm } from '../../../utils/notifications.js'

let users = []
let filtered = []
let filterState = {
    search: '',
    type: 'all' // all, with_business, no_business
}

document.addEventListener('DOMContentLoaded', async () => {
    const { isAdmin } = await authGuard.checkAdminSession()
    if (!isAdmin) { window.location.href = '/login'; return; }

    const user = await authService.getCurrentUser()
    if (user) document.getElementById('adminEmail').textContent = user.email

    await loadData()
    setupListeners()
    setupModalListeners()
})

async function loadData() {
    const icon = document.querySelector('#refreshBtn i')
    if (icon) icon.classList.add('fa-spin')

    try {
        const { success, data, error } = await adminService.getUsersWithBusinesses()

        if (success) {
            users = data
            applyFilters()
        } else {
            notify.error('Error cargando usuarios: ' + error)
        }
    } catch (e) {
        console.error(e)
        notify.error('Error inesperado')
    } finally {
        if (icon) icon.classList.remove('fa-spin')
    }
}

function applyFilters() {
    const term = filterState.search.toLowerCase()

    filtered = users.filter(u => {
        // Search
        const matchSearch =
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.business_name && u.business_name.toLowerCase().includes(term))

        // Type
        let matchType = true
        if (filterState.type === 'no_business') matchType = !u.business_id
        if (filterState.type === 'with_business') matchType = !!u.business_id

        return matchSearch && matchType
    })

    updateCounts()
    renderTable()
}

function updateCounts() {
    document.getElementById('countTotal').textContent = users.length
    document.getElementById('countWithBus').textContent = users.filter(u => u.business_id).length
    document.getElementById('countNoBus').textContent = users.filter(u => !u.business_id).length
}

function renderTable() {
    const tbody = document.getElementById('usersTableBody')
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No se encontraron usuarios</td></tr>'
        return
    }

    tbody.innerHTML = ''
    filtered.forEach(u => {
        const tr = document.createElement('tr')
        tr.className = u.business_id ? 'user-row with-business' : 'user-row no-business'

        const date = adminUtils.formatDate(u.user_created_at)

        // Business Status Badge
        let statusBadge = '<span class="badge" style="background:#e5e7eb; color:#374151;">Sin Negocio</span>'
        if (u.business_id) {
            if (u.business_status) statusBadge = '<span class="badge active">Activo</span>'
            else statusBadge = '<span class="badge paused">Inactivo</span>'

            if (u.business_plan === 'trial') statusBadge += ' <small>(Trial)</small>'
        }

        // Actions
        let actions = ''
        if (u.business_id) {
            actions = `
                <button class="action-btn view" title="Ver Negocio" onclick="window.location.href='/admin/business-detail?id=${u.business_id}'">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button class="action-btn setup" title="Setup Catálogo" onclick="window.location.href='/admin/setup-catalogo?negocio_id=${u.business_id}'">
                    <i class="fa-solid fa-box-open"></i>
                </button>
                <button class="action-btn delete" title="Eliminar usuario y negocio" onclick="window.openDeleteModal('${u.user_id}', '${u.email}', '${(u.business_name || '').replace(/'/g, "\\'")}')"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            `
        } else {
            actions = `
                <button class="action-btn" style="background:var(--primary); color:white;" title="Crear Negocio" 
                    onclick="window.openCreateModal('${u.user_id}', '${u.email}')">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button class="action-btn delete" title="Eliminar usuario" onclick="window.openDeleteModal('${u.user_id}', '${u.email}', null)">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight:500;">${u.email}</div>
                <small style="color:var(--text-secondary); font-size:0.75rem;">ID: ${u.user_id.substring(0, 8)}...</small>
            </td>
            <td>
                ${u.business_name ? `<strong>${u.business_name}</strong>` : '<span style="color:#9ca3af; font-style:italic;">-</span>'}
            </td>
            <td>${statusBadge}</td>
            <td style="text-transform:capitalize;">${u.business_plan || '-'}</td>
            <td>${date}</td>
            <td style="text-align:right;">
                <div class="action-buttons" style="justify-content: flex-end;">${actions}</div>
            </td>
        `
        tbody.appendChild(tr)
    })
}

function setupListeners() {
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', loadData)

    // Search
    document.getElementById('searchInput').addEventListener('input', adminUtils.debounce((e) => {
        filterState.search = e.target.value
        applyFilters()
    }, 300))

    // Filters
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            filterState.type = btn.dataset.filter
            applyFilters()
        })
    })

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authService.signOut()
        authGuard.clearAdminCache()
        window.location.href = '/login'
    })
}

// Modal Logic
function setupModalListeners() {
    // Expose open function globally so onclick in HTML works (module scope issue)
    window.openCreateModal = (userId, email) => {
        document.getElementById('modalUserId').value = userId
        document.getElementById('modalUserEmail').value = email
        document.getElementById('createBusinessForm').reset()
        // Restore hidden inputs if reset clears them? No, value set after reset or reset manually
        // Actually reset clears value attribute if not in HTML. 
        document.getElementById('modalUserId').value = userId
        document.getElementById('modalUserEmail').value = email
        document.getElementById('createBusinessModal').style.display = 'flex'
    }

    document.getElementById('createBusinessForm').addEventListener('submit', async (e) => {
        e.preventDefault()

        const userId = document.getElementById('modalUserId').value
        const email = document.getElementById('modalUserEmail').value // readonly, just for context
        const name = document.getElementById('modalBusName').value
        const phone = document.getElementById('modalBusPhone').value
        const description = document.getElementById('modalBusDescription').value
        const plan = document.getElementById('modalBusPlan').value
        const days = parseInt(document.getElementById('modalBusTrialDays').value) || 30

        // Address
        const address = document.getElementById('modalBusAddress').value

        // Validation
        if (!name) return notify.error('Nombre es requerido')

        // Confirm
        if (!(await confirm.show({
            title: 'Crear Negocio',
            message: `¿Crear negocio "${name}" para ${email}?`,
            type: 'info'
        }))) return

        const loading = notify.loading('Creando negocio...')

        // Calc trial end
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + days)

        const businessData = {
            name,
            email, // contact email defaults to user email
            phone,
            description,
            plan,
            is_active: true, // Auto active
            plan_expires_at: expiry.toISOString(),
            address: address
        }

        const { success, error } = await adminService.createBusiness(userId, businessData)

        if (success) {
            notify.updateLoading(loading, 'Negocio creado exitosamente')
            document.getElementById('createBusinessModal').style.display = 'none'
            loadData() // Refresh table
        } else {
            notify.updateLoading(loading, error, 'error')
        }
    })

    // --- Delete User Modal ---

    window.openDeleteModal = (userId, email, businessName) => {
        // Populate modal info
        document.getElementById('deleteTargetUserId').value = userId
        document.getElementById('deleteUserEmail').textContent = email
        document.getElementById('deleteConfirmEmailHint').textContent = email

        const businessRow = document.getElementById('deleteUserBusinessRow')
        if (businessName) {
            document.getElementById('deleteUserBusinessName').textContent = businessName
            businessRow.style.display = 'block'
        } else {
            businessRow.style.display = 'none'
        }

        // Reset to step 1
        document.getElementById('deleteProceedBlock').style.display = 'block'
        document.getElementById('deleteConfirmStep').classList.remove('visible')
        document.getElementById('deleteConfirmInput').value = ''
        document.getElementById('deleteConfirmInput').classList.remove('matched')
        document.getElementById('deleteConfirmBtn').disabled = true

        document.getElementById('deleteUserModal').style.display = 'flex'
    }

    // Step 1 → Step 2
    document.getElementById('deleteProceedBtn').addEventListener('click', () => {
        document.getElementById('deleteProceedBlock').style.display = 'none'
        document.getElementById('deleteConfirmStep').classList.add('visible')
        document.getElementById('deleteConfirmInput').focus()
    })

    // Habilitar botón solo cuando el email coincide exactamente
    document.getElementById('deleteConfirmInput').addEventListener('input', (e) => {
        const expectedEmail = document.getElementById('deleteUserEmail').textContent.trim()
        const typedEmail = e.target.value.trim()
        const matches = typedEmail.toLowerCase() === expectedEmail.toLowerCase()

        document.getElementById('deleteConfirmBtn').disabled = !matches
        e.target.classList.toggle('matched', matches)
    })

    // Confirmar y ejecutar eliminación
    document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
        const userId = document.getElementById('deleteTargetUserId').value
        const email = document.getElementById('deleteUserEmail').textContent

        // Seguridad adicional: verificar coincidencia de email
        const typedEmail = document.getElementById('deleteConfirmInput').value.trim()
        if (typedEmail.toLowerCase() !== email.toLowerCase()) {
            notify.error('El email no coincide')
            return
        }

        // Cerrar modal y mostrar loading
        document.getElementById('deleteUserModal').style.display = 'none'
        const loading = notify.loading(`Eliminando usuario ${email}...`)

        const { success, error, storageErrors } = await adminService.deleteUserComplete(userId)

        if (success) {
            let msg = `Usuario ${email} eliminado correctamente`
            if (storageErrors) {
                msg += ` (advertencia Storage: ${storageErrors.join(', ')})`
                notify.updateLoading(loading, msg, 'warning')
            } else {
                notify.updateLoading(loading, msg, 'success')
            }
            loadData() // Recargar tabla
        } else {
            notify.updateLoading(loading, `Error: ${error}`, 'error')
        }
    })
}
