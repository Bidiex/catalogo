import { linksService } from '../../services/links-service.js'
import { authService } from '../../services/auth.js'
import { notify, confirm } from '../../utils/notifications.js'

let currentState = {
    business: null,
    businessId: null,
    pageId: null,
    items: [],
    pageSettings: null,
    draggedItem: null
}

let isInitialized = false
let UI = {}

// --- Initialization ---

export async function initLinksEditor(businessData = null) {
    try {
        // Always re-select UI elements to ensure we have valid references if the DOM was updated
        // although links-editor structure is usually static in this project.
        initUI()

        // 2. Set Context
        if (businessData) {
            currentState.business = businessData
            currentState.businessId = businessData.id
        } else {
            const user = await authService.getCurrentUser()
            if (!user || !user.business_id) return
            currentState.businessId = user.business_id
            // Fetch business if not passed (though dashboard usually passes it)
            // For now assume logic continues, loadData generally just needs ID
        }

        console.log('Initializing Links Editor for:', currentState.businessId)

        // 3. Load Data
        await loadData()

        // 4. Setup Listeners
        // Setup Listeners
        // We call this every time init is called (navigation), so we use a safe attach method
        setupEventListeners()

    } catch (error) {
        console.error('Error init links editor:', error)
        notify.error('Error al cargar el editor de enlaces')
    }
}

function initUI() {
    UI = {
        container: document.getElementById('links-editor-container'),
        list: document.getElementById('linksListConfig'),
        preview: document.getElementById('previewButtonsContainer'),
        btnAdd: document.getElementById('addLinkBtn'),
        copyBtn: document.getElementById('copyPublicLinkBtn'),
        slugDisplay: document.getElementById('editorSlugDisplay'),

        // Preview Elements
        previewLogo: document.getElementById('previewLogo'),
        previewName: document.getElementById('previewName'),

        // Background UI
        bgBtn: document.getElementById('backgroundBtn'),
        bgModal: document.getElementById('backgroundModal'),
        bgForm: document.getElementById('backgroundForm'),
        bgImageInput: document.getElementById('bg-image-input'),
        bgImagePreview: document.getElementById('bg-image-preview'),
        bgImageActions: document.getElementById('bg-image-actions'),
        btnChangeBg: document.getElementById('btn-change-bg-image'),
        btnRemoveBg: document.getElementById('btn-remove-bg-image'),
        closeBgModalBtn: document.getElementById('closeBackgroundModalBtn'),
        cancelBgBtn: document.getElementById('cancelBackgroundBtn'),

        // Modal Elements (Link)
        modal: document.getElementById('linkModal'),
        form: document.getElementById('linkForm'),
        modalTitle: document.getElementById('linkModalTitle'),
        closeBtn: document.getElementById('closeLinkModalBtn'),
        cancelBtn: document.getElementById('cancelLinkBtn'),

        // Form Inputs (Link)
        inputId: document.getElementById('linkId'),
        inputLabel: document.getElementById('linkLabel'),
        inputUrl: document.getElementById('linkUrl'),
        inputStyle: document.getElementById('linkButtonStyle'),
        inputIsActive: document.getElementById('linkIsActive'),
        styleOptions: document.querySelectorAll('.style-option'),

        // Color Inputs (Link)
        inputButtonColor: document.getElementById('linkButtonColor'),
        inputTextColor: document.getElementById('linkTextColor'),
        buttonColorOptions: document.querySelectorAll('.link-color-option'),
        textColorOptions: document.querySelectorAll('.text-color-option'),

        // Social Modal Elements
        btnAddSocial: document.getElementById('addSocialBtn'),
        socialModal: document.getElementById('socialModal'),
        socialForm: document.getElementById('socialForm'),
        closeSocialBtn: document.getElementById('closeSocialModalBtn'),
        cancelSocialBtn: document.getElementById('cancelSocialBtn'),
        socialLinkId: document.getElementById('socialLinkId'),
        socialNetwork: document.getElementById('socialNetwork'),
        socialNetworkTiles: document.querySelectorAll('.social-network-tile'),
        socialUrl: document.getElementById('socialUrl'),
        socialButtonColor: document.getElementById('socialButtonColor'),
        socialTextColor: document.getElementById('socialTextColor'),
        socialColorOptions: document.querySelectorAll('#socialColorPalette .link-color-option'),
        socialTextColorOptions: document.querySelectorAll('#socialModal .text-color-option'),
        socialIsActive: document.getElementById('socialIsActive')
    }
}

async function loadData() {
    try {
        // 1. Get or Create Page
        let page = await linksService.getLinkPage(currentState.businessId)
        if (!page) {
            page = await linksService.createLinkPage(currentState.businessId)
        }
        currentState.pageId = page.id
        currentState.pageSettings = {
            background_color: page.background_color || '#f8fafc',
            background_image_url: page.background_image_url || null,
            button_style_default: page.button_style_default || 'filled'
        }

        // 2. Get Items
        const items = await linksService.getLinkItems(page.id)
        currentState.items = items.sort((a, b) => a.position - b.position)

        // 3. Render
        render()

    } catch (error) {
        console.error('Error loading data:', error)
        notify.error('Error al cargar datos')
    }
}

function setupEventListeners() {
    console.log('Setting up Link Editor Listeners...')

    // Simplest approach: Direct onclick assignment.
    // This overwrites previous listeners and avoids duplication without cloning.

    if (UI.btnAdd) UI.btnAdd.onclick = () => openModal()

    if (UI.bgBtn) UI.bgBtn.onclick = openBackgroundModal

    if (UI.copyBtn) UI.copyBtn.onclick = processCopyLink

    if (UI.closeBtn) UI.closeBtn.onclick = closeModal
    if (UI.cancelBtn) UI.cancelBtn.onclick = closeModal
    if (UI.form) UI.form.onsubmit = handleFormSubmit

    if (UI.closeBgModalBtn) UI.closeBgModalBtn.onclick = closeBackgroundModal
    if (UI.cancelBgBtn) UI.cancelBgBtn.onclick = closeBackgroundModal
    if (UI.bgForm) UI.bgForm.onsubmit = handleBackgroundSubmit

    // Style Selection
    if (UI.styleOptions) {
        UI.styleOptions.forEach(option => {
            option.onclick = () => {
                UI.styleOptions.forEach(opt => opt.classList.remove('selected'))
                option.classList.add('selected')
                if (UI.inputStyle) UI.inputStyle.value = option.dataset.style
            }
        })
    }

    // Button Color Palette Selection
    if (UI.buttonColorOptions) {
        UI.buttonColorOptions.forEach(option => {
            option.style.backgroundColor = option.dataset.color
            option.onclick = () => {
                UI.buttonColorOptions.forEach(opt => opt.classList.remove('selected'))
                option.classList.add('selected')
                if (UI.inputButtonColor) UI.inputButtonColor.value = option.dataset.color
            }
        })
    }

    // Text Color Selection
    if (UI.textColorOptions) {
        UI.textColorOptions.forEach(option => {
            option.onclick = () => {
                UI.textColorOptions.forEach(opt => opt.classList.remove('selected'))
                option.classList.add('selected')
                if (UI.inputTextColor) UI.inputTextColor.value = option.dataset.color
            }
        })
    }

    // Background Image Handling
    if (UI.bgImagePreview) {
        UI.bgImagePreview.onclick = () => UI.bgImageInput && UI.bgImageInput.click()
    }
    if (UI.btnChangeBg) {
        UI.btnChangeBg.onclick = () => UI.bgImageInput && UI.bgImageInput.click()
    }
    if (UI.bgImageInput) {
        UI.bgImageInput.onchange = handleBgImageSelect
    }
    if (UI.btnRemoveBg) {
        UI.btnRemoveBg.onclick = handleRemoveBgImage
    }

    // Social Modal
    if (UI.btnAddSocial) UI.btnAddSocial.onclick = () => openSocialModal()
    if (UI.closeSocialBtn) UI.closeSocialBtn.onclick = closeSocialModal
    if (UI.cancelSocialBtn) UI.cancelSocialBtn.onclick = closeSocialModal
    if (UI.socialForm) UI.socialForm.onsubmit = handleSocialSubmit

    if (UI.socialNetworkTiles) {
        UI.socialNetworkTiles.forEach(tile => {
            tile.onclick = () => {
                UI.socialNetworkTiles.forEach(t => t.classList.remove('selected'))
                tile.classList.add('selected')
                if (UI.socialNetwork) UI.socialNetwork.value = tile.dataset.network

                // Auto-fill brand color
                const brandColors = {
                    facebook: '#1877f2',
                    instagram: '#e1306c',
                    youtube: '#ff0000',
                    twitter: '#000000'
                }
                const brandColor = brandColors[tile.dataset.network]
                if (brandColor && UI.socialButtonColor) {
                    UI.socialButtonColor.value = brandColor
                    UI.socialColorOptions.forEach(opt => {
                        opt.classList.toggle('selected', opt.dataset.color === brandColor)
                    })
                }
            }
        })
    }

    if (UI.socialColorOptions) {
        UI.socialColorOptions.forEach(opt => {
            opt.style.backgroundColor = opt.dataset.color
            opt.onclick = () => {
                UI.socialColorOptions.forEach(o => o.classList.remove('selected'))
                opt.classList.add('selected')
                if (UI.socialButtonColor) UI.socialButtonColor.value = opt.dataset.color
            }
        })
    }

    if (UI.socialTextColorOptions) {
        UI.socialTextColorOptions.forEach(opt => {
            opt.onclick = () => {
                UI.socialTextColorOptions.forEach(o => o.classList.remove('selected'))
                opt.classList.add('selected')
                if (UI.socialTextColor) UI.socialTextColor.value = opt.dataset.color
            }
        })
    }

    // Color swatch live preview
    if (UI.bgColorInput && UI.bgColorPreview) {
        UI.bgColorInput.oninput = () => {
            UI.bgColorPreview.style.backgroundColor = UI.bgColorInput.value
        }
    }
}

// --- Rendering ---

function render() {
    renderList()
    renderPreview()
}

function renderList() {
    if (!UI.list) return
    UI.list.innerHTML = ''

    const regularItems = currentState.items.filter(i => i.item_type !== 'social')
    const socialItems = currentState.items.filter(i => i.item_type === 'social')

    if (regularItems.length === 0 && socialItems.length === 0) {
        UI.list.innerHTML = `<div class="empty-state text-center p-4 text-gray-500">No hay enlaces creados.</div>`
    }

    regularItems.forEach(item => {
        UI.list.appendChild(createLinkItemEl(item))
    })

    if (socialItems.length > 0) {
        const divider = document.createElement('div')
        divider.className = 'social-list-divider'
        divider.textContent = 'Redes Sociales'
        UI.list.appendChild(divider)

        socialItems.forEach(item => {
            UI.list.appendChild(createSocialItemEl(item))
        })
    }

    // Re-attach drag and drop on the list container
    setupDragAndDrop()
}

function createLinkItemEl(item) {
    const itemEl = document.createElement('div')
    itemEl.className = 'link-item'
    if (!item.is_active) itemEl.classList.add('opacity-75')

    const isCatalog = item.is_catalog_link

    itemEl.innerHTML = `
        <div class="link-handle" ${isCatalog ? 'aria-hidden="true"' : ''}>
            <i class="ri-drag-move-2-line"></i>
        </div>
        <div class="link-item-info">
            <div class="link-label">${item.label}</div>
            <div class="link-url">${item.url}</div>
            <div class="link-meta">
                <span class="link-badge badge-style">${item.button_style || 'Default'}</span>
                <span class="link-badge badge-status ${item.is_active ? '' : 'inactive'}">
                    ${item.is_active ? 'Visible' : 'Oculto'}
                </span>
                ${isCatalog ? '<span class="link-badge badge-fijo">Fijo</span>' : ''}
            </div>
        </div>
        <div class="link-actions">
            ${!isCatalog ? `
                <button class="btn-icon-action edit-btn" title="Editar">
                    <i class="ri-edit-line"></i>
                </button>
                <button class="btn-icon-action danger delete-btn" title="Eliminar">
                    <i class="ri-delete-bin-line"></i>
                </button>
            ` : `
               <button class="btn-icon-action edit-btn" title="Editar estilo">
                    <i class="ri-edit-line"></i>
                </button>
            `}
        </div>
    `

    const editBtn = itemEl.querySelector('.edit-btn')
    if (editBtn) editBtn.addEventListener('click', () => openModal(item))

    const deleteBtn = itemEl.querySelector('.delete-btn')
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteLink(item.id))

    if (!isCatalog) {
        itemEl.dataset.itemId = item.id
        itemEl.setAttribute('draggable', 'false')

        const handle = itemEl.querySelector('.link-handle')
        if (handle) {
            handle.addEventListener('pointerdown', () => itemEl.setAttribute('draggable', 'true'))
            handle.addEventListener('pointerup', () => itemEl.setAttribute('draggable', 'false'))
        }
        itemEl.addEventListener('dragstart', handleDragStart)
        itemEl.addEventListener('dragend', handleDragEnd)
    } else {
        const handle = itemEl.querySelector('.link-handle')
        if (handle) handle.classList.add('link-handle--hidden')
    }

    itemEl.addEventListener('dragover', handleDragOver)
    itemEl.addEventListener('drop', handleDrop)
    return itemEl
}

function createSocialItemEl(item) {
    const NETWORK_ICONS = {
        facebook: 'ri-facebook-fill',
        instagram: 'ri-instagram-line',
        youtube: 'ri-youtube-fill',
        twitter: 'ri-twitter-x-line'
    }
    const NETWORK_LABELS = {
        facebook: 'Facebook',
        instagram: 'Instagram',
        youtube: 'YouTube',
        twitter: 'X / Twitter'
    }

    const itemEl = document.createElement('div')
    itemEl.className = 'link-item social-link-item'
    if (!item.is_active) itemEl.classList.add('opacity-75')

    const icon = NETWORK_ICONS[item.social_network] || 'ri-share-line'
    const label = NETWORK_LABELS[item.social_network] || item.social_network

    itemEl.innerHTML = `
        <div class="social-item-icon">
            <i class="${icon}"></i>
        </div>
        <div class="link-item-info">
            <div class="link-label">${label}</div>
            <div class="link-url">${item.url}</div>
            <div class="link-meta">
                <span class="link-badge badge-status ${item.is_active ? '' : 'inactive'}">
                    ${item.is_active ? 'Visible' : 'Oculto'}
                </span>
            </div>
        </div>
        <div class="link-actions">
            <button class="btn-icon-action edit-btn" title="Editar">
                <i class="ri-edit-line"></i>
            </button>
            <button class="btn-icon-action danger delete-btn" title="Eliminar">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
    `

    const editBtn = itemEl.querySelector('.edit-btn')
    if (editBtn) editBtn.addEventListener('click', () => openSocialModal(item))

    const deleteBtn = itemEl.querySelector('.delete-btn')
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteLink(item.id))

    return itemEl
}

function setupDragAndDrop() {
    if (!UI.list) return
    UI.list.addEventListener('dragover', handleDragOver)
    UI.list.addEventListener('drop', handleDrop)
}


let draggedItem = null

function handleDragStart(e) {
    // e.target may be a child (icon), so we walk up to the .link-item
    draggedItem = e.target.closest('.link-item')
    if (!draggedItem) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', draggedItem.dataset.itemId)
    // Defer adding the class so the browser can capture the drag image first
    setTimeout(() => draggedItem.classList.add('dragging'), 0)
}

function handleDragEnd() {
    if (draggedItem) {
        draggedItem.classList.remove('dragging')
        draggedItem.setAttribute('draggable', 'false')
    }
    draggedItem = null
}

function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
}

function handleDrop(e) {
    e.preventDefault()
    if (!draggedItem) return

    // Find the target .link-item (element we dropped onto)
    const target = e.target.closest('.link-item')
    if (!target || target === draggedItem) return

    // Determine insertion: before or after the target based on mouse Y
    const targetRect = target.getBoundingClientRect()
    const insertBefore = e.clientY < targetRect.top + targetRect.height / 2

    if (insertBefore) {
        UI.list.insertBefore(draggedItem, target)
    } else {
        UI.list.insertBefore(draggedItem, target.nextSibling)
    }

    // Rebuild currentState.items order from the DOM
    const newOrder = []
    UI.list.querySelectorAll('.link-item[data-item-id]').forEach((el, index) => {
        const id = el.dataset.itemId
        const item = currentState.items.find(i => String(i.id) === String(id))
        if (item) newOrder.push({ ...item, position: index })
    })

    // Include catalog items (non-draggable) at their DOM positions
    const allItems = Array.from(UI.list.querySelectorAll('.link-item')).map((el, index) => {
        const id = el.dataset.itemId
        if (id) {
            const item = currentState.items.find(i => String(i.id) === String(id))
            return item ? { ...item, position: index } : null
        }
        // Catalog items don't have data-item-id; find them by exclusion
        const catalogItem = currentState.items.find(
            i => i.is_catalog_link && !newOrder.some(o => o.id === i.id)
        )
        return catalogItem ? { ...catalogItem, position: index } : null
    }).filter(Boolean)

    currentState.items = allItems.sort((a, b) => a.position - b.position)

    // Persist new order (fire and forget — optimistic UI)
    const positionUpdates = currentState.items.map((item, idx) => ({ id: item.id, position: idx }))
    linksService.reorderItems(positionUpdates).catch(err => {
        console.error('Error al guardar el orden de los enlaces:', err)
        notify.error('No se pudo guardar el nuevo orden')
    })

    // Update the preview without re-rendering the list (avoids losing drag state)
    renderPreview()
}

function renderPreview() {
    if (!UI.preview) return
    UI.preview.innerHTML = ''

    // Update Header Info (Logo/Name)
    if (UI.previewName && currentState.business) {
        UI.previewName.textContent = currentState.business.name || 'Mi Negocio'
    }
    if (UI.previewLogo && currentState.business) {
        if (currentState.business.logo_url) {
            UI.previewLogo.src = currentState.business.logo_url
            UI.previewLogo.style.display = 'block'
        } else {
            // Placeholder or Hide
            UI.previewLogo.src = 'https://via.placeholder.com/80?text=Logo' // Or specific logic
        }
    }

    // Update container background
    const screen = UI.preview.closest('.mockup-screen')
    if (screen) {
        const { background_image_url } = currentState.pageSettings || {}

        if (background_image_url) {
            screen.style.backgroundImage = `url('${background_image_url}')`
            screen.style.backgroundSize = 'cover'
            screen.style.backgroundPosition = 'center'
            screen.style.backgroundRepeat = 'no-repeat'
        } else {
            screen.style.backgroundImage = ''
            screen.style.backgroundColor = '#ffffff'
        }
    }


    // Render regular link buttons
    currentState.items
        .filter(i => i.item_type !== 'social' && i.is_active)
        .forEach(item => {
            const btn = document.createElement('a')
            let styleType = item.button_style || 'filled'
            let modClass = 'btn-link--filled'
            let shapeClass = 'shape--semi-rounded'

            if (styleType === 'outlined') modClass = 'btn-link--outlined'
            if (styleType === 'rounded') shapeClass = 'shape--rounded'
            if (styleType === 'square') shapeClass = 'shape--square'
            if (styleType === 'semi-rounded') shapeClass = 'shape--semi-rounded'

            btn.className = `btn-link ${modClass} ${shapeClass}`
            btn.href = item.url || '#'
            btn.target = '_blank'
            btn.textContent = item.label

            if (item.button_color) btn.style.backgroundColor = item.button_color
            if (item.text_color) btn.style.color = item.text_color

            UI.preview.appendChild(btn)
        })

    // Render social circles below regular links
    const activeSocials = currentState.items.filter(i => i.item_type === 'social' && i.is_active)
    if (activeSocials.length > 0) {
        const socialsRow = document.createElement('div')
        socialsRow.className = 'preview-socials-row'

        const NETWORK_ICONS = {
            facebook: 'ri-facebook-fill',
            instagram: 'ri-instagram-line',
            youtube: 'ri-youtube-fill',
            twitter: 'ri-twitter-x-line'
        }

        activeSocials.forEach(item => {
            const circle = document.createElement('a')
            circle.href = item.url || '#'
            circle.target = '_blank'
            circle.className = 'preview-social-circle'
            circle.title = item.social_network
            circle.style.backgroundColor = item.button_color || '#1e293b'
            circle.style.color = item.text_color || '#ffffff'

            const icon = NETWORK_ICONS[item.social_network] || 'ri-share-line'
            circle.innerHTML = `<i class="${icon}"></i>`
            socialsRow.appendChild(circle)
        })

        UI.preview.appendChild(socialsRow)
    }
}


// --- Link Modal Logic ---

function openModal(item = null) {
    if (!UI.modal) return

    const defaultButtonColor = '#1e293b'
    const defaultTextColor = '#ffffff'

    if (item) {
        // Edit Mode
        if (UI.modalTitle) UI.modalTitle.textContent = 'Editar Enlace'
        if (UI.inputId) UI.inputId.value = item.id
        if (UI.inputLabel) UI.inputLabel.value = item.label
        if (UI.inputUrl) UI.inputUrl.value = item.url
        if (UI.inputStyle) UI.inputStyle.value = item.button_style || 'semi-rounded'
        if (UI.inputIsActive) UI.inputIsActive.checked = item.is_active
        if (UI.inputButtonColor) UI.inputButtonColor.value = item.button_color || defaultButtonColor
        if (UI.inputTextColor) UI.inputTextColor.value = item.text_color || defaultTextColor

        // Handle Catalog Link restrictions
        if (item.is_catalog_link) {
            if (UI.inputUrl) UI.inputUrl.disabled = true
            if (UI.inputLabel) UI.inputLabel.focus()
        } else {
            if (UI.inputUrl) UI.inputUrl.disabled = false
            if (UI.inputLabel) UI.inputLabel.focus()
        }

    } else {
        // Add Mode
        if (UI.modalTitle) UI.modalTitle.textContent = 'Nuevo Enlace'
        if (UI.form) UI.form.reset()
        if (UI.inputId) UI.inputId.value = ''
        if (UI.inputStyle) UI.inputStyle.value = 'semi-rounded'
        if (UI.inputIsActive) UI.inputIsActive.checked = true
        if (UI.inputUrl) UI.inputUrl.disabled = false
        if (UI.inputButtonColor) UI.inputButtonColor.value = defaultButtonColor
        if (UI.inputTextColor) UI.inputTextColor.value = defaultTextColor
    }

    // Update Style Selection UI
    if (UI.styleOptions && UI.inputStyle) {
        UI.styleOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.style === UI.inputStyle.value)
        })
    }

    // Update Button Color Selection UI
    if (UI.buttonColorOptions && UI.inputButtonColor) {
        const currentColor = UI.inputButtonColor.value
        UI.buttonColorOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === currentColor)
        })
    }

    // Update Text Color Selection UI
    if (UI.textColorOptions && UI.inputTextColor) {
        const currentTextColor = UI.inputTextColor.value
        UI.textColorOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === currentTextColor)
        })
    }

    UI.modal.style.display = 'flex'
}

function closeModal() {
    if (UI.modal) UI.modal.style.display = 'none'
    if (UI.form) UI.form.reset()
}

async function handleFormSubmit(e) {
    e.preventDefault()

    const formData = {
        label: UI.inputLabel ? UI.inputLabel.value.trim() : '',
        url: UI.inputUrl ? UI.inputUrl.value.trim() : '',
        button_style: UI.inputStyle ? UI.inputStyle.value : 'filled',
        button_color: UI.inputButtonColor ? UI.inputButtonColor.value : '#1e293b',
        text_color: UI.inputTextColor ? UI.inputTextColor.value : '#ffffff',
        is_active: UI.inputIsActive ? UI.inputIsActive.checked : true
    }

    if (!formData.label) {
        notify.error('Por favor completa los campos requeridos')
        return
    }
    // URL valida para no-catalogo
    // if (!isCatalog && !url) ... (logic handled by html required mostly, but good to check)

    const id = UI.inputId ? UI.inputId.value : ''

    try {
        if (id) {
            // Update
            const updated = await linksService.updateLinkItem(id, formData)
            const idx = currentState.items.findIndex(i => i.id === id)
            if (idx !== -1) currentState.items[idx] = updated
            notify.success('Enlace actualizado')
        } else {
            // Create
            formData.position = currentState.items.length
            const created = await linksService.addLinkItem(currentState.pageId, formData)
            currentState.items.push(created)
            notify.success('Enlace creado')
        }

        closeModal()
        render() // Only update Preview here

    } catch (error) {
        console.error('Error saving link:', error)
        notify.error('No se pudo guardar el enlace')
    }
}

async function deleteLink(id) {
    const isConfirmed = await confirm.show({
        title: '¿Eliminar enlace?',
        message: 'Esta acción no se puede deshacer.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    })

    if (!isConfirmed) return

    try {
        await linksService.deleteLinkItem(id)
        currentState.items = currentState.items.filter(i => i.id !== id)
        render()
        notify.success('Enlace eliminado')
    } catch (error) {
        console.error('Error deleting link:', error)
        notify.error('Error al eliminar')
    }
}

// --- Social Modal Logic ---

function openSocialModal(item = null) {
    if (!UI.socialModal) return

    // Reset form
    if (UI.socialForm) UI.socialForm.reset()
    if (UI.socialLinkId) UI.socialLinkId.value = ''
    if (UI.socialIsActive) UI.socialIsActive.checked = true

    // Reset tile selection
    if (UI.socialNetworkTiles) {
        UI.socialNetworkTiles.forEach(t => t.classList.remove('selected'))
    }

    const defaultColor = '#1e293b'
    const defaultTextColor = '#ffffff'

    if (item) {
        // Edit mode
        if (UI.socialLinkId) UI.socialLinkId.value = item.id
        if (UI.socialUrl) UI.socialUrl.value = item.url || ''
        if (UI.socialIsActive) UI.socialIsActive.checked = item.is_active
        if (UI.socialButtonColor) UI.socialButtonColor.value = item.button_color || defaultColor
        if (UI.socialTextColor) UI.socialTextColor.value = item.text_color || defaultTextColor

        // Select correct network tile
        if (UI.socialNetworkTiles && item.social_network) {
            UI.socialNetworkTiles.forEach(t => {
                if (t.dataset.network === item.social_network) t.classList.add('selected')
            })
            if (UI.socialNetwork) UI.socialNetwork.value = item.social_network
        }

        // Sync color palettes
        const bgColor = item.button_color || defaultColor
        const txtColor = item.text_color || defaultTextColor
        if (UI.socialColorOptions) {
            UI.socialColorOptions.forEach(o => o.classList.toggle('selected', o.dataset.color === bgColor))
        }
        if (UI.socialTextColorOptions) {
            UI.socialTextColorOptions.forEach(o => o.classList.toggle('selected', o.dataset.color === txtColor))
        }
    } else {
        // Create mode — preset colors
        if (UI.socialButtonColor) UI.socialButtonColor.value = defaultColor
        if (UI.socialTextColor) UI.socialTextColor.value = defaultTextColor
        if (UI.socialColorOptions) {
            UI.socialColorOptions.forEach(o => o.classList.toggle('selected', o.dataset.color === defaultColor))
        }
        if (UI.socialTextColorOptions) {
            UI.socialTextColorOptions.forEach(o => o.classList.toggle('selected', o.dataset.color === defaultTextColor))
        }
    }

    UI.socialModal.style.display = 'flex'
}

function closeSocialModal() {
    if (UI.socialModal) UI.socialModal.style.display = 'none'
    if (UI.socialForm) UI.socialForm.reset()
}

async function handleSocialSubmit(e) {
    e.preventDefault()

    const network = UI.socialNetwork ? UI.socialNetwork.value : ''
    const url = UI.socialUrl ? UI.socialUrl.value.trim() : ''

    if (!network) {
        notify.error('Selecciona una red social')
        return
    }
    if (!url) {
        notify.error('Ingresa la URL del perfil')
        return
    }

    const formData = {
        label: network,
        url,
        item_type: 'social',
        social_network: network,
        button_color: UI.socialButtonColor ? UI.socialButtonColor.value : '#1e293b',
        text_color: UI.socialTextColor ? UI.socialTextColor.value : '#ffffff',
        is_active: UI.socialIsActive ? UI.socialIsActive.checked : true
    }

    const id = UI.socialLinkId ? UI.socialLinkId.value : ''

    try {
        if (id) {
            const updated = await linksService.updateLinkItem(id, formData)
            const idx = currentState.items.findIndex(i => i.id === id)
            if (idx !== -1) currentState.items[idx] = updated
            notify.success('Red social actualizada')
        } else {
            formData.position = currentState.items.length
            const created = await linksService.addLinkItem(currentState.pageId, formData)
            currentState.items.push(created)
            notify.success('Red social añadida')
        }
        closeSocialModal()
        render()
    } catch (error) {
        console.error('Error saving social link:', error)
        notify.error('Error al guardar la red social')
    }
}

// --- Background Modal Logic ---

let tempBgFile = null
let tempBgColor = '#f8fafc'

function openBackgroundModal() {
    if (!UI.bgModal) return
    tempBgFile = null
    updateModalBgPreview(currentState.pageSettings?.background_image_url || null)
    UI.bgModal.style.display = 'flex'
}

function closeBackgroundModal() {
    if (UI.bgModal) UI.bgModal.style.display = 'none'
    if (UI.bgForm) UI.bgForm.reset()
    tempBgFile = null
}

function handleBgImageSelect(e) {
    const file = e.target.files[0]
    if (file) {
        tempBgFile = file
        const reader = new FileReader()
        reader.onload = (e) => updateModalBgPreview(e.target.result)
        reader.readAsDataURL(file)
    }
}

function handleRemoveBgImage() {
    tempBgFile = 'DELETE' // Marker to delete
    updateModalBgPreview(null)
}

function updateModalBgPreview(url) {
    if (!UI.bgImagePreview) return

    if (url) {
        UI.bgImagePreview.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-lg">`
        if (UI.bgImageActions) UI.bgImageActions.style.display = 'flex'
    } else {
        UI.bgImagePreview.innerHTML = `
            <i class="ri-image-add-line text-3xl text-gray-400"></i>
            <p class="text-sm text-gray-500 mt-2">Click para subir imagen</p>
        `
        if (UI.bgImageActions) UI.bgImageActions.style.display = 'none'
    }
}

async function handleBackgroundSubmit(e) {
    e.preventDefault()

    try {
        let newImageUrl = currentState.pageSettings?.background_image_url || null

        if (tempBgFile === 'DELETE') {
            newImageUrl = null
        } else if (tempBgFile && typeof tempBgFile !== 'string') {
            notify.info('Subiendo imagen...')
            const result = await linksService.uploadBackgroundImage(tempBgFile)
            newImageUrl = result.url
        }

        const bgPayload = {
            background_image_url: newImageUrl,
            button_style_default: currentState.pageSettings?.button_style_default || 'filled'
        }

        await linksService.upsertLinkPage(currentState.businessId, bgPayload)

        currentState.pageSettings = {
            ...currentState.pageSettings,
            background_image_url: newImageUrl
        }
        renderPreview()
        closeBackgroundModal()
        notify.success('Fondo actualizado')

    } catch (error) {
        console.error('Error saving background:', error)
        notify.error('Error al guardar el fondo')
    }
}


function updatePreview() {
    renderPreview()
}

function processCopyLink() {
    // El slug pertenece al negocio, no a la página de enlaces
    const slug = currentState.business?.slug
    if (!slug) return notify.error('Aún no tienes un enlace generado')

    const url = `${window.location.origin}/l/${slug}`
    navigator.clipboard.writeText(url)
        .then(() => notify.success('Enlace copiado: ' + url))
        .catch(() => notify.error('Error al copiar enlace'))
}

// Helper for darkening color
function adjustColorBrightness(hex, percent) {
    hex = hex.replace(/^\s*#|\s*$/g, '');
    if (hex.length === 3) {
        hex = hex.replace(/(.)/g, '$1$1');
    }
    var r = parseInt(hex.substr(0, 2), 16),
        g = parseInt(hex.substr(2, 2), 16),
        b = parseInt(hex.substr(4, 2), 16);

    return '#' +
        ((0 | (1 << 8) + r + (256 - r) * percent / 100).toString(16)).substr(1) +
        ((0 | (1 << 8) + g + (256 - g) * percent / 100).toString(16)).substr(1) +
        ((0 | (1 << 8) + b + (256 - b) * percent / 100).toString(16)).substr(1);
}
