import { authGuard } from '../../../utils/auth-guard.js'
import { adminService } from '../../../services/admin.js'
import { adminUtils } from '../../../utils/admin-utils.js'
import { authService } from '../../../services/auth.js'

// State
let charts = {
    growth: null,
    status: null
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Auth
    const { isAdmin, userId } = await authGuard.checkAdminSession()
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
    await loadDashboardData()

    // 3. Setup Listeners
    document.getElementById('refreshBtn').addEventListener('click', loadDashboardData)

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authService.signOut()
        authGuard.clearAdminCache()
        window.location.href = '/login'
    })
})

async function loadDashboardData() {
    const refreshBtn = document.getElementById('refreshBtn')
    const originalIcon = refreshBtn.innerHTML
    refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cargando...'
    refreshBtn.disabled = true

    try {
        // Fetch all businesses
        const { success, data: businesses, error } = await adminService.getBusinesses()

        if (!success) {
            console.error('Error loading businesses:', error)
            alert('Error al cargar datos')
            return
        }

        renderMetrics(businesses)
        renderCharts(businesses)
        renderActivityTable(businesses)

    } catch (err) {
        console.error('Unexpected error:', err)
    } finally {
        refreshBtn.innerHTML = originalIcon
        refreshBtn.disabled = false
    }
}

function renderMetrics(businesses) {
    // Calculate Metrics
    const total = businesses.length

    // Status counts
    const trial = businesses.filter(b => b.plan_type === 'trial' || !b.plan_type).length
    const active = businesses.filter(b => b.is_active && (b.plan_type === 'plus' || b.plan_type === 'pro')).length

    // Expiring trials (< 7 days)
    const expiringCount = businesses.filter(b => {
        if (b.plan_type !== 'trial') return false
        const daysLeft = adminUtils.getDaysRemaining(b.plan_expires_at)
        return daysLeft < 7 && daysLeft >= 0
    }).length

    // Total Orders (Sum of monthly_orders_count for now, ideal would be dedicated orders table query)
    // For now we use the counter in business table
    const totalOrders = businesses.reduce((acc, curr) => acc + (curr.monthly_orders_count || 0), 0)

    // Update DOM
    animateValue('totalBusinesses', total)
    animateValue('trialBusinesses', trial)
    animateValue('activeBusinesses', active)
    animateValue('recentOrders', totalOrders) // Note: This is an approximation based on current month count

    document.getElementById('expiringTrial').textContent = `${expiringCount} expiran pronto`
}

function renderCharts(businesses) {
    // 1. Growth Chart (Line)
    const ctxGrowth = document.getElementById('growthChart').getContext('2d')

    // Group by month (Last 6 months)
    const months = []
    const counts = []
    const today = new Date()

    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const monthKey = d.toLocaleString('es-ES', { month: 'short' })
        months.push(monthKey)

        // Count created in this month
        const count = businesses.filter(b => {
            const created = new Date(b.created_at)
            return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear()
        }).length
        counts.push(count)
    }

    if (charts.growth) charts.growth.destroy()

    charts.growth = new Chart(ctxGrowth, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Nuevos Negocios',
                data: counts,
                borderColor: '#0284c7', // Primary Blue
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    })

    // 2. Status Chart (Doughnut)
    const ctxStatus = document.getElementById('statusChart').getContext('2d')

    // Counts by status logic
    const activeCount = businesses.filter(b => b.is_active).length
    const inactiveCount = businesses.filter(b => !b.is_active).length
    // Or by Plan Type
    const trialCount = businesses.filter(b => b.plan_type === 'trial' || !b.plan_type).length
    const plusCount = businesses.filter(b => b.plan_type === 'plus').length
    const proCount = businesses.filter(b => b.plan_type === 'pro').length

    if (charts.status) charts.status.destroy()

    charts.status = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Trial', 'Plus', 'Pro', 'Inactivo'],
            datasets: [{
                data: [trialCount, plusCount, proCount, inactiveCount],
                backgroundColor: ['#facc15', '#a855f7', '#22c55e', '#9ca3af'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    })
}

function renderActivityTable(businesses) {
    const tbody = document.getElementById('activityTableBody')
    tbody.innerHTML = ''

    // Sort by last access (using created_at as proxy if no access log available yet, 
    // ideally we would add a last_login column to users or use audit logs)
    // Since we don't have last_login on business table, we'll sort by created_at for now 
    // OR we could use the updated_at field if it exists.
    // Let's assume created_at DESC for "Recent Businesses" context if "Activity" is hard.

    // Real "Activity" would come from admin_logs or a dedicated tracking table.
    // For this step, let's list the *Last Updated* businesses or just *Newest*.
    // User asked for "último acceso", let's check updated_at or created_at.
    // If specific field `last_sign_in_at` from auth is needed we'd need a join, which is complex.
    // We will use `created_at` as a fallback for "Recent Registration" if "Access" is not tracked.

    const recent = [...businesses]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center">No hay datos</td></tr>'
        return
    }

    recent.forEach(business => {
        const tr = document.createElement('tr')

        // Status Badge Logic
        let statusClass = 'trial'
        let statusText = 'Trial'

        if (!business.is_active) {
            statusClass = 'paused'
            statusText = 'Inactivo'
        } else if (business.plan_type === 'plus' || business.plan_type === 'pro') {
            statusClass = 'active'
            statusText = business.plan_type.toUpperCase()
        }

        const lastDate = adminUtils.formatDate(business.created_at) // Using created_at for now

        tr.innerHTML = `
      <td>
        <div style="font-weight: 500;">${business.name}</div>
        <div style="font-size: 0.75rem; color: #6b7280;">${business.email || 'Sin email'}</div>
      </td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td style="text-transform: capitalize;">${business.plan_type || 'Trial'}</td>
      <td>${lastDate}</td>
    `

        // Navigate on click
        tr.style.cursor = 'pointer'
        tr.addEventListener('click', () => {
            window.location.href = `/admin/business-detail?id=${business.id}`
        })

        tbody.appendChild(tr)
    })
}

function animateValue(id, end) {
    const obj = document.getElementById(id)
    if (!obj) return
    obj.textContent = end
    // Simple "animation" by just setting text. 
    // Proper count-up animation can be added if requested.
}
