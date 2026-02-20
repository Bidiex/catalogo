import { linksService } from '../../services/links-service.js'

document.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading')
    const content = document.getElementById('linksPage')
    const errorState = document.getElementById('errorState')

    try {
        // 1. Obtener slug de la URL
        // Soportamos dos patrones:
        //   /l/:slug          (Centro de Enlaces público)
        //   /c/:slug/links    (ruta legacy)
        const pathParts = window.location.pathname.split('/').filter(Boolean)

        let slug = null

        if (pathParts[0] === 'l' && pathParts[1]) {
            // Patrón: /l/:slug
            slug = pathParts[1]
        } else if (pathParts.includes('links')) {
            // Patrón: /c/:slug/links
            const idx = pathParts.indexOf('links')
            if (idx > 0) slug = pathParts[idx - 1]
        } else {
            slug = pathParts[0]
        }

        if (!slug) {
            throw new Error('No slug found')
        }

        // 2. Obtener datos
        // Usamos una función nueva del servicio pública (sin auth)
        // Pero como estamos reutilizando el servicio existente que usa supabase client,
        // necesitamos asegurarnos que tiene acceso público.
        // Aquí simularemos el cliente público o usaremos query normal si las políticas lo permiten.
        const data = await linksService.getPublicLinksBySlug(slug)

        if (!data || !data.page) {
            throw new Error('Page not found')
        }

        // 3. Renderizar
        renderPage(data)

        // Mostrar contenido
        loading.style.display = 'none'
        content.style.display = 'flex'

    } catch (err) {
        console.error('Error loading links page:', err)
        loading.style.display = 'none'
        errorState.style.display = 'flex'
    }
})

function renderPage({ business, page, items }) {
    // Configurar Tema (Colores)
    if (business.primary_color) {
        document.documentElement.style.setProperty('--primary-color', business.primary_color)
    }

    // Header
    document.getElementById('businessName').textContent = business.name
    document.getElementById('businessDesc').textContent = business.description || ''

    const logoImg = document.getElementById('businessLogo')
    if (business.logo_url) {
        logoImg.src = business.logo_url
    } else {
        logoImg.src = '/src/assets/icon_traego.svg' // Fallback
    }

    // Fondo (Si existiera en el futuro, por ahora link_pages no tiene background field, usamos default)
    // if (page.background_image) ...

    // Render Items
    const container = document.getElementById('linksContainer')
    container.innerHTML = ''

    items.forEach(item => {
        const btn = document.createElement('a')
        btn.href = item.url
        btn.textContent = item.label
        btn.target = '_blank'
        btn.rel = 'noopener noreferrer'

        // Clases base
        btn.className = 'btn-link'

        // Estilo global de botones definido en la página
        const style = page.button_style || 'semi-rounded'

        // Mapear estilo a clases CSS
        // filled, outlined
        // rounded, semi-rounded, square

        // Lógica para separar forma de relleno
        let fillClass = 'btn-link--filled'
        let shapeClass = 'shape--semi-rounded'

        // Interpretamos el estilo compuesto si es necesario, o simple del enum
        // El enum tiene: 'filled', 'outlined', 'rounded', 'semi-rounded', 'square'
        // Esto es un poco ambiguo en el requerimiento ("selector de estilo global").
        // Asumiremos que el estilo define la FORMA y el TIPO.
        // Vamos a simplificar: "filled" es solido semi-redondo por defecto? 
        // O el usuario elige forma Y tipo? El requerimiento dice "Selector de estilo global... filled, outlined, rounded..."
        // Parece una sola lista.
        // Vamos a inferir clases.

        if (style === 'filled') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'outlined') {
            fillClass = 'btn-link--outlined'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'rounded') {
            // Pill shape filled
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--rounded'
        } else if (style === 'semi-rounded') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--semi-rounded'
        } else if (style === 'square') {
            fillClass = 'btn-link--filled'
            shapeClass = 'shape--square'
        }

        // Si es catálogo, tal vez queramos forzar filled para destacar
        if (item.is_catalog_link) {
            btn.classList.add('btn-link--catalog')
            // Mantenemos shape pero forzamos filled si es outlined para que destaque? 
            // Mejor respetamos la consistencia visual por ahora.
        }

        btn.classList.add(fillClass)
        btn.classList.add(shapeClass)

        // Icono opcional (si tuviéramos)

        container.appendChild(btn)
    })
}
