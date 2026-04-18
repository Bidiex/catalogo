import { authService } from '../../../services/auth.js'
import { businessService } from '../../../services/business.js'

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading')
  const contentEl = document.getElementById('content-container')
  const btnWhatsappConfirm = document.getElementById('btnWhatsappConfirm')

  try {
    // 1. Verify user session
    const session = await authService.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    // 2. Load business info
    const business = await businessService.getMyBusiness()
    if (!business) {
      window.location.href = '/dashboard'
      return
    }

    // Capture generic support contact phone
    // Currently defined in dashboard.js as 573180779665
    // we use a centralized one or hardcoded here:
    const ADMIN_PHONE = '573180779665'

    // Get URL Param
    const urlParams = new URLSearchParams(window.location.search)
    const plan = urlParams.get('plan') || business.plan_type || 'pro'
    
    // Generate Pre-filled Wa.me message
    let message = ''
    if (plan === 'pro') {
      message = `Hola, vengo de la plataforma TraeGo. Acabo de realizar el pago del Plan PRO para mi negocio: *${business.name}*. Adjunto el comprobante oficial 📄.`
    } else {
      message = `Hola, vengo de la plataforma TraeGo. Acabo de renovar mi suscripción para mi negocio: *${business.name}*. Adjunto el comprobante oficial 📄.`
    }

    const waLink = `https://wa.me/${ADMIN_PHONE}?text=${encodeURIComponent(message)}`

    // Attach to button
    btnWhatsappConfirm.addEventListener('click', () => {
      window.open(waLink, '_blank')
    })

    // Show content
    loadingEl.style.display = 'none'
    contentEl.style.display = 'block'

  } catch (error) {
    console.error('Error load payment pending flow:', error)
    window.location.href = '/dashboard'
  }
})
