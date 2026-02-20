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
        bgColorInput: document.getElementById('bg-color-input'),
        bgColorPreview: document.getElementById('bg-color-preview-swatch'),
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
        styleOptions: document.querySelectorAll('.style-option')
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

    if (currentState.items.length === 0) {
        UI.list.innerHTML = `<div class="empty-state text-center p-4 text-gray-500">No hay enlaces creados.</div>`
    }

    currentState.items.forEach(item => {
        const itemEl = document.createElement('div')
        itemEl.className = 'link-item'
        if (!item.is_active) itemEl.classList.add('opacity-75')

        const isCatalog = item.is_catalog_link

        itemEl.innerHTML = `
            <div class="link-handle" ${isCatalog ? 'style="visibility:hidden"' : ''}>
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
                    ${isCatalog ? '<span class="link-badge" style="background:#e0f2fe; color:#0369a1">Fijo</span>' : ''}
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

        // Bind Events
        const editBtn = itemEl.querySelector('.edit-btn')
        if (editBtn) editBtn.addEventListener('click', () => openModal(item))

        const deleteBtn = itemEl.querySelector('.delete-btn')
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteLink(item.id))

        UI.list.appendChild(itemEl)
    })
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
        const { background_image_url, background_color } = currentState.pageSettings

        if (background_image_url) {
            screen.style.backgroundImage = `url('${background_image_url}')`
            screen.style.backgroundSize = 'cover'
            screen.style.backgroundPosition = 'center'
            screen.style.backgroundRepeat = 'no-repeat'
        } else {
            const color = background_color || '#f8fafc'
            screen.style.backgroundImage = `linear-gradient(180deg, ${color} 0%, ${adjustColorBrightness(color, -20)} 100%)`
            screen.style.backgroundSize = 'auto'
        }
    }

    currentState.items.forEach(item => {
        // En preview solo mostramos activos O si el usuario quiere ver todo?
        if (!item.is_active) return

        const btn = document.createElement('a')

        let styleType = item.button_style || 'filled'
        let baseClass = 'btn-link'
        let modClass = 'btn-link--filled'
        let shapeClass = 'shape--semi-rounded'

        if (styleType === 'outlined') modClass = 'btn-link--outlined'

        if (styleType === 'rounded') shapeClass = 'shape--rounded'
        if (styleType === 'square') shapeClass = 'shape--square'
        if (styleType === 'semi-rounded') shapeClass = 'shape--semi-rounded'

        btn.className = `${baseClass} ${modClass} ${shapeClass}`

        btn.href = item.url || '#'
        btn.target = '_blank'
        btn.textContent = item.label

        UI.preview.appendChild(btn)
    })
}

// --- Link Modal Logic ---

function openModal(item = null) {
    if (!UI.modal) return

    if (item) {
        // Edit Mode
        if (UI.modalTitle) UI.modalTitle.textContent = 'Editar Enlace'
        if (UI.inputId) UI.inputId.value = item.id
        if (UI.inputLabel) UI.inputLabel.value = item.label
        if (UI.inputUrl) UI.inputUrl.value = item.url
        if (UI.inputStyle) UI.inputStyle.value = item.button_style || 'semi-rounded'
        if (UI.inputIsActive) UI.inputIsActive.checked = item.is_active

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
    }

    // Update Style Selection UI
    if (UI.styleOptions && UI.inputStyle) {
        UI.styleOptions.forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.style === UI.inputStyle.value)
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

// --- Background Modal Logic ---

let tempBgFile = null
let tempBgColor = '#f8fafc'

function openBackgroundModal() {
    if (!UI.bgModal) return

    // Reset temp state
    tempBgFile = null
    tempBgColor = currentState.pageSettings.background_color || '#f8fafc'

    if (UI.bgColorInput) UI.bgColorInput.value = tempBgColor
    if (UI.bgColorPreview) UI.bgColorPreview.style.backgroundColor = tempBgColor

    // Update UI Preview in Modal (not the real preview)
    updateModalBgPreview(currentState.pageSettings.background_image_url)

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

    // Get color
    const newColor = UI.bgColorInput ? UI.bgColorInput.value : '#f8fafc'

    try {
        let newImageUrl = currentState.pageSettings.background_image_url

        // Handle Image Upload/Delete
        if (tempBgFile === 'DELETE') {
            newImageUrl = null
        } else if (tempBgFile && typeof tempBgFile !== 'string') {
            // Upload
            notify.info('Subiendo imagen...')
            const result = await linksService.uploadBackgroundImage(tempBgFile)
            newImageUrl = result.url
        }

        // Save — solo enviamos los campos de fondo, nunca campos de identidad como slug
        const bgPayload = {
            background_color: newColor,
            background_image_url: newImageUrl,
            button_style_default: currentState.pageSettings.button_style_default || 'filled'
        }

        await linksService.upsertLinkPage(currentState.businessId, bgPayload)

        // Actualizar el estado local con los valores guardados
        currentState.pageSettings = {
            ...currentState.pageSettings,
            background_color: newColor,
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
