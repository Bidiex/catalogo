import { linksService } from '../../services/links-service.js'

document.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading')
    const content = document.getElementById('linksPage')
    const errorState = document.getElementById('errorState')

    try {
        // 1. Obtener slug de la URL
        const pathParts = window.location.pathname.split('/').filter(Boolean)

        let slug = null

        if (pathParts[0] === 'l' && pathParts[1]) {
            slug = pathParts[1]
        } else if (pathParts.includes('links')) {
            const idx = pathParts.indexOf('links')
            if (idx > 0) slug = pathParts[idx - 1]
        } else {
            slug = pathParts[0]
        }

        if (!slug) throw new Error('No slug found')

        // 2. Obtener datos
        const data = await linksService.getPublicLinksBySlug(slug)

        if (!data || !data.page) throw new Error('Page not found')

        // 3. Renderizar
        renderPage(data)

        loading.style.display = 'none'
        content.style.display = 'flex'

        // En desktop: envolver en la silueta de smartphone
        applyPhoneFrame(content, data.page)

    } catch (err) {
        if (err.message !== 'Page not found') {
            console.error('Error loading links page:', err)
        }
        loading.style.display = 'none'
        errorState.style.display = 'flex'
        document.body.classList.add('is-error-state')
    }
})

/**
 * En pantallas >= 768px, envuelve el contenido en una silueta de teléfono.
 * En mobile no hace nada.
 */
function applyPhoneFrame(contentEl, page) {
    if (window.innerWidth < 768) return

    const frame = document.createElement('div')
    frame.className = 'phone-frame'

    // Si hay imagen de fondo, la movemos al frame (no al body)
    if (page.background_image_url) {
        document.body.classList.remove('has-bg-image')
        frame.classList.add('has-bg-image')
    }

    // Reemplazar el main en el DOM por: body > frame > main
    contentEl.parentNode.insertBefore(frame, contentEl)
    frame.appendChild(contentEl)
}

function renderPage({ business, page, items }) {
    // Aplicar color primario del negocio como variable CSS global
    if (business.primary_color) {
        document.documentElement.style.setProperty('--primary-color', business.primary_color)
    }

    // Aplicar imagen de fondo si existe
    if (page.background_image_url) {
        document.documentElement.style.setProperty('--page-bg-image', `url('${page.background_image_url}')`)
        document.body.classList.add('has-bg-image')
    }

    // Actualizar título y favicon
    document.title = `Enlaces ${business.name}`
    const favicon = document.querySelector('link[rel="icon"]')
    if (favicon && business.logo_url) {
        favicon.href = business.logo_url
    }

    // Header
    const nameEl = document.getElementById('businessName')
    const descEl = document.getElementById('businessDesc')
    nameEl.textContent = business.name
    descEl.textContent = business.description || ''

    const tColor = page.text_color || '#0f172a'
    nameEl.style.color = tColor
    descEl.style.color = tColor

    const logoImg = document.getElementById('businessLogo')
    if (business.logo_url) {
        logoImg.src = business.logo_url
    } else {
        logoImg.src = '/src/assets/icon_traego.svg'
    }

    // Estilo global de la página (fallback si el ítem no tiene su propio estilo)
    const pageButtonStyle = page.button_style || 'semi-rounded'

    // Separar ítems regulares de los de redes sociales
    const regularItems = items
        .filter(item => item.is_active !== false && item.item_type !== 'social')
        .sort((a, b) => (b.is_catalog_link ? 1 : 0) - (a.is_catalog_link ? 1 : 0))
    const socialItems = items.filter(item => item.is_active !== false && item.item_type === 'social')

    // Render regular link buttons
    const container = document.getElementById('linksContainer')
    container.innerHTML = ''

    regularItems.forEach(item => {
        const btn = document.createElement('a')
        btn.href = item.url
        btn.textContent = item.label
        btn.target = '_blank'
        btn.rel = 'noopener noreferrer'
        btn.className = 'btn-link'

        const style = item.button_style || pageButtonStyle
        const buttonColor = item.button_color || null
        const textColor = item.text_color || null

        let fillClass = 'btn-link--filled'
        let shapeClass = 'shape--semi-rounded'

        if (style === 'filled') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'outlined') {
            fillClass = 'btn-link--outlined'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'rounded') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--rounded'
        } else if (style === 'semi-rounded') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'square') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--square'
        }

        btn.classList.add(fillClass, shapeClass)

        if (buttonColor) {
            btn.style.setProperty('--btn-item-bg', buttonColor)
            btn.classList.add('btn-link--custom-color')
        }
        if (textColor) {
            btn.style.setProperty('--btn-item-color', textColor)
            btn.classList.add('btn-link--custom-text')
        }

        if (item.is_catalog_link) {
            btn.classList.add('btn-link--catalog')
        }

        // Registrar clic localmente sin interrumpir navegación
        btn.addEventListener('click', () => {
            if (item.id) linksService.incrementLinkClick(item.id)
        })

        container.appendChild(btn)
    })

    // Render social circles below regular links
    const NETWORK_ICONS = {
        facebook: 'ri-facebook-fill',
        instagram: 'ri-instagram-line',
        youtube: 'ri-youtube-fill',
        twitter: 'ri-twitter-x-line'
    }

    const socialsContainer = document.getElementById('socialsContainer')
    if (socialsContainer) {
        socialsContainer.innerHTML = ''

        socialItems.forEach(item => {
            const circle = document.createElement('a')
            circle.href = item.url
            circle.target = '_blank'
            circle.rel = 'noopener noreferrer'
            circle.className = 'social-circle'
            circle.title = item.social_network

            const bgColor = item.button_color || '#1e293b'
            const txtColor = item.text_color || '#ffffff'
            circle.style.setProperty('--social-bg', bgColor)
            circle.style.setProperty('--social-color', txtColor)

            const iconClass = NETWORK_ICONS[item.social_network] || 'ri-share-line'
            circle.innerHTML = `<i class="${iconClass}"></i>`

            // Registrar clic localmente sin interrumpir navegación
            circle.addEventListener('click', () => {
                if (item.id) linksService.incrementLinkClick(item.id)
            })

            socialsContainer.appendChild(circle)
        })
    }
}

