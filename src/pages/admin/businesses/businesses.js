import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { adminUtils } from '../../../utils/admin-utils.js'
import { authService } from '../../../services/auth.js'

// State
let state = {
    businesses: [],
    filtered: [],
    currentPage: 1,
    itemsPerPage: 20,
    sort: { col: 'created_at', asc: false },
    filter: { status: 'all', search: '' }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const { isAdmin } = await authGuard.checkAdminSession()
    if (!isAdmin) {
        window.location.href = '/login'
        return
    }

    const user = await authService.getCurrentUser()
    if (user) document.getElementById('adminEmail').textContent = user.email

    // Load Data
    await loadBusinesses()

    // Listeners
    setupListeners()
})

async function loadBusinesses() {
    const refreshBtn = document.getElementById('refreshBtn')
    const icon = refreshBtn.querySelector('i')
    icon.classList.add('fa-spin')
    refreshBtn.disabled = true

    try {
        const { success, data, error } = await adminService.getBusinesses()

        if (success) {
            state.businesses = data
            applyFilters()
        } else {
            console.error('Error:', error)
            alert('Error al cargar negocios')
        }
    } catch (err) {
        console.error(err)
    } finally {
        icon.classList.remove('fa-spin')
        refreshBtn.disabled = false
    }
}

function setupListeners() {
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', loadBusinesses)

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authService.signOut()
        authGuard.clearAdminCache()
        window.location.href = '/login'
    })

    // Search
    const searchInput = document.getElementById('searchInput')
    searchInput.addEventListener('input', adminUtils.debounce((e) => {
        state.filter.search = e.target.value.toLowerCase().trim()
        state.currentPage = 1
        applyFilters()
    }, 300))

    // Filter Chips
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
            // Add active to clicked
            btn.classList.add('active')
            // Update state
            state.filter.status = btn.dataset.filter
            state.currentPage = 1
            applyFilters()
        })
    })

    // Sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort

            // Toggle direction if clicking same col
            if (state.sort.col === col) {
                state.sort.asc = !state.sort.asc
            } else {
                state.sort.col = col
                state.sort.asc = true // Default asc for new col
            }

            updateSortIcons()
            sortData()
            renderTable()
            renderPagination()
        })
    })
}

function applyFilters() {
    let result = [...state.businesses]

    // Filter by Status
    if (state.filter.status !== 'all') {
        result = result.filter(b => {
            // New logic: trial plan no longer exists.
            const isTrial = false // Deprecated
            const isActive = b.is_active
            const isPaused = !b.is_active
            // Cancelled logic: active but expired? or just paused?
            // "Active" means is_active = true and plan not expired? 
            // User said: "negocio inmediatamente entra en plan Plus... no existe plan trial"
            // So if is_active = true, it's active.

            // Check expiry for "Active" vs "Expired"?
            // Using simple is_active for now as requested by user logic "si le cobro... lo manejo manualmente"
            // But maybe filter "expired"?
            // For now map chips to simple states

            switch (state.filter.status) {
                case 'active': return isActive
                case 'paused': return isPaused
                // case 'cancelled': return ...
                default: return true
            }
        })
    }

    // Filter by Search
    if (state.filter.search) {
        const term = state.filter.search
        result = result.filter(b =>
            b.name.toLowerCase().includes(term) ||
            (b.email && b.email.toLowerCase().includes(term))
        )
    }

    state.filtered = result
    updateCounts()
    sortData() // re-sort after filter
    renderTable()
    renderPagination()
}

function updateCounts() {
    const all = state.businesses.length

    // Logic updated
    const active = state.businesses.filter(b => b.is_active).length
    const paused = state.businesses.filter(b => !b.is_active).length

    document.getElementById('count-all').textContent = all
    document.getElementById('count-active').textContent = active
    document.getElementById('count-paused').textContent = paused

    // Trial count removed or 0
    // document.getElementById('count-trial').textContent = 0
}

function sortData() {
    state.filtered.sort((a, b) => {
        let valA = a[state.sort.col]
        let valB = b[state.sort.col]

        // Handle special cases
        if (state.sort.col === 'status') {
            valA = a.is_active ? 1 : 0
            valB = b.is_active ? 1 : 0
        }
        // Removed plan sort
        if (state.sort.col === 'orders') valA = a.monthly_orders_count || 0

        // Null handling
        if (valA === null || valA === undefined) valA = ''
        if (valB === null || valB === undefined) valB = ''

        if (valA < valB) return state.sort.asc ? -1 : 1
        if (valA > valB) return state.sort.asc ? 1 : -1
        return 0
    })
}

function updateSortIcons() {
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('active')
        const icon = th.querySelector('.sort-icon')
        icon.className = 'fa-solid fa-sort sort-icon'

        if (th.dataset.sort === state.sort.col) {
            th.classList.add('active')
            icon.className = state.sort.asc
                ? 'fa-solid fa-sort-up sort-icon'
                : 'fa-solid fa-sort-down sort-icon'
        }
    })
}

function paginate() {
    const start = (state.currentPage - 1) * state.itemsPerPage
    const end = start + state.itemsPerPage
    return state.filtered.slice(start, end)
}

function renderTable() {
    const tbody = document.getElementById('businessesTableBody')
    const totalEl = document.getElementById('totalResults')

    // Update header count
    totalEl.textContent = `${state.filtered.length} negocios encontrados`

    // Empty state
    if (state.filtered.length === 0) {
        const msg = state.filter.search
            ? `No se encontraron negocios con "${state.filter.search}"`
            : 'No hay negocios registrados aún'

        tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <div style="color: var(--text-tertiary); font-size: 3rem; margin-bottom: 1rem;">
            <i class="fa-solid fa-store-slash"></i>
          </div>
          <p style="color: var(--text-secondary);">${msg}</p>
        </td>
      </tr>
    `
        return
    }

    // Render rows
    const pageData = paginate()
    tbody.innerHTML = ''

    pageData.forEach(b => {
        const tr = document.createElement('tr')

        // Status Logic
        let statusBadge = ''
        if (!b.is_active) {
            statusBadge = '<span class="badge paused">Inactivo</span>'
        } else {
            // Check expiry
            const days = adminUtils.getDaysRemaining(b.plan_expires_at)
            if (days < 0) {
                statusBadge = '<span class="badge paused" style="background:#fee2e2; color:#991b1b;">Vencido</span>'
            } else {
                statusBadge = `<span class="badge active">Activo (${days}d)</span>`
            }
        }

        const date = adminUtils.formatDate(b.created_at)

        tr.innerHTML = `
      <td style="font-weight: 500;">${b.name}</td>
      <!-- Email column removed -->
      <td>${statusBadge}</td>
      <!-- Plan column removed -->
      <td>${b.monthly_orders_count || 0}</td>
      <td style="white-space: nowrap;">${date}</td>
      <td style="text-align: right;">
        <div class="action-buttons" style="justify-content: flex-end;">
          <button class="action-btn view" title="Ver Detalle" onclick="window.location.href='/admin/business-detail?id=${b.id}'">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="action-btn setup" title="Setup Catálogo" onclick="window.location.href='/admin/setup-catalogo?negocio_id=${b.id}'">
            <i class="fa-solid fa-box-open"></i>
          </button>
        </div>
      </td>
    `
        tbody.appendChild(tr)
    })
}

function renderPagination() {
    const container = document.getElementById('paginationContainer')
    const totalPages = Math.ceil(state.filtered.length / state.itemsPerPage)

    if (totalPages <= 1) {
        container.style.display = 'none'
        return
    }

    container.style.display = 'flex'
    const start = (state.currentPage - 1) * state.itemsPerPage + 1
    const end = Math.min(start + state.itemsPerPage - 1, state.filtered.length)

    document.getElementById('paginationInfo').textContent = `Mostrando ${start}-${end} de ${state.filtered.length}`

    const controls = document.getElementById('paginationControls')
    controls.innerHTML = ''

    // Prev
    const prevBtn = document.createElement('button')
    prevBtn.className = 'page-btn'
    prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>'
    prevBtn.disabled = state.currentPage === 1
    prevBtn.onclick = () => changePage(state.currentPage - 1)
    controls.appendChild(prevBtn)

    // Pages
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button')
        btn.className = `page-btn ${i === state.currentPage ? 'active' : ''}`
        btn.textContent = i
        btn.onclick = () => changePage(i)
        controls.appendChild(btn)
    }

    // Next
    const nextBtn = document.createElement('button')
    nextBtn.className = 'page-btn'
    nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>'
    nextBtn.disabled = state.currentPage === totalPages
    nextBtn.onclick = () => changePage(state.currentPage + 1)
    controls.appendChild(nextBtn)
}

function changePage(page) {
    state.currentPage = page
    renderTable()
    renderPagination()
}
