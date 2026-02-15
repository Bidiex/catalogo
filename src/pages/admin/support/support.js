import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { authService } from '../../../services/auth.js'
import { adminUtils } from '../../../utils/admin-utils.js'

let allTickets = []
let currentFilter = 'all'

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Auth
    const { isAdmin } = await authGuard.checkAdminSession()
    if (!isAdmin) {
        window.location.href = '/login'
        return
    }

    // Set User Email
    const user = await authService.getCurrentUser()
    if (user) {
        document.getElementById('adminEmail').textContent = user.email
    }

    // 2. Initial Load
    await loadTickets()

    // 3. Setup Listeners
    setupEventListeners()
})

async function loadTickets() {
    const refreshBtn = document.getElementById('refreshBtn')
    const originalIcon = refreshBtn.innerHTML
    refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...'
    refreshBtn.disabled = true

    try {
        const { success, data, error } = await adminService.getSupportTickets()

        if (!success) {
            console.error('Error loading tickets:', error)
            adminUtils.showToast('Error al cargar tickets: ' + error.message, 'error')
            return
        }

        allTickets = data
        renderTickets()

    } catch (err) {
        console.error('Unexpected error:', err)
    } finally {
        refreshBtn.innerHTML = originalIcon
        refreshBtn.disabled = false
    }
}

function renderTickets() {
    const tbody = document.getElementById('ticketsTableBody')
    tbody.innerHTML = ''

    // Filter
    let filtered = allTickets.filter(t => {
        if (currentFilter === 'all') return true
        return t.status === currentFilter
    })

    // Search
    const searchTerm = document.getElementById('searchInput').value.toLowerCase()
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.ticket_code.toLowerCase().includes(searchTerm) ||
            t.title.toLowerCase().includes(searchTerm) ||
            (t.businesses?.name || '').toLowerCase().includes(searchTerm)
        )
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No se encontraron tickets</td></tr>'
        return
    }

    filtered.forEach(ticket => {
        const tr = document.createElement('tr')
        tr.className = 'ticket-row'

        const date = adminUtils.formatDate(ticket.created_at)
        const businessName = ticket.businesses?.name || 'Sin Negocio'

        tr.innerHTML = `
            <td>
                <span style="font-family: monospace; font-weight: 600;">${ticket.ticket_code}</span>
            </td>
            <td>
                <div style="font-weight: 500;">${businessName}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">${ticket.contact_name}</div>
            </td>
            <td>
                <div style="font-weight: 500;">${ticket.title}</div>
            </td>
            <td>
                <span class="badge-status ${ticket.status}">${formatStatus(ticket.status)}</span>
            </td>
            <td>
                <span class="badge-priority ${ticket.priority}">${formatPriority(ticket.priority)}</span>
            </td>
            <td>${date}</td>
            <td style="text-align: right;">
                <button class="btn-icon" title="Ver Detalle">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        `

        tr.addEventListener('click', () => openTicketModal(ticket))

        tbody.appendChild(tr)
    })
}

function setupEventListeners() {
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', loadTickets)

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authService.signOut()
        authGuard.clearAdminCache()
        window.location.href = '/login'
    })

    // Search
    document.getElementById('searchInput').addEventListener('input', renderTickets)

    // Filters
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
            // Add active
            e.target.classList.add('active')
            // Set filter
            currentFilter = e.target.dataset.filter
            renderTickets()
        })
    })

    // Update Status
    document.getElementById('btnUpdateStatus').addEventListener('click', updateStatus)
}

let currentTicketId = null

function openTicketModal(ticket) {
    currentTicketId = ticket.id

    document.getElementById('modalTicketCode').textContent = ticket.ticket_code
    document.getElementById('modalTicketTitle').textContent = ticket.title
    document.getElementById('modalTicketDesc').textContent = ticket.description

    document.getElementById('modalTicketBusiness').textContent = ticket.businesses?.name || 'N/A'
    document.getElementById('modalTicketContact').textContent = ticket.contact_name
    document.getElementById('modalTicketPhone').textContent = ticket.contact_phone || 'N/A'

    // Image
    const imgContainer = document.getElementById('modalTicketImage')
    const imgTag = imgContainer.querySelector('img')
    if (ticket.image_url) {
        imgTag.src = ticket.image_url
        imgContainer.style.display = 'block'
    } else {
        imgContainer.style.display = 'none'
    }

    // Status & Priority
    document.getElementById('modalTicketStatus').value = ticket.status
    document.getElementById('modalTicketPriority').value = ticket.priority || 'normal'

    document.getElementById('ticketModal').style.display = 'flex'
}

async function updateStatus() {
    if (!currentTicketId) return

    const newStatus = document.getElementById('modalTicketStatus').value
    const newPriority = document.getElementById('modalTicketPriority').value

    const btn = document.getElementById('btnUpdateStatus')
    const originalText = btn.textContent
    btn.textContent = 'Guardando...'
    btn.disabled = true

    try {
        const { success, error } = await adminService.updateTicket(currentTicketId, {
            status: newStatus,
            priority: newPriority
        })

        if (success) {
            // Update local state
            const ticketIndex = allTickets.findIndex(t => t.id === currentTicketId)
            if (ticketIndex !== -1) {
                allTickets[ticketIndex].status = newStatus
                allTickets[ticketIndex].priority = newPriority
            }
            renderTickets()
            document.getElementById('ticketModal').style.display = 'none'
            adminUtils.showToast('Ticket actualizado correctamente', 'success')
        } else {
            adminUtils.showToast('Error al actualizar: ' + error, 'error')
        }
    } catch (e) {
        console.error(e)
        adminUtils.showToast('Error inesperado', 'error')
    } finally {
        btn.textContent = originalText
        btn.disabled = false
    }
}

function formatStatus(status) {
    const map = {
        'pending': 'Pendiente',
        'in_progress': 'En Progreso',
        'resolved': 'Resuelto',
        'closed': 'Cerrado'
    }
    return map[status] || status
}

function formatPriority(priority) {
    const map = {
        'low': 'Baja',
        'normal': 'Normal',
        'high': 'Alta',
        'urgent': 'Urgente'
    }
    return map[priority] || priority
}
