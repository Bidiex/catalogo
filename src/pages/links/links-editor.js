import { linksService } from '../../services/links-service.js'
import { authService } from '../../services/auth.js'
import { notify, confirm } from '../../utils/notifications.js'

let currentState = {
    businessId: null,
    pageId: null,
    items: [],
    pageSettings: null,
    draggedItem: null
}

const UI = {
    container: document.getElementById('links-editor-container'),
    list: document.getElementById('linksListConfig'),
    preview: document.getElementById('previewButtonsContainer'),
    btnAdd: document.getElementById('addLinkBtn'),
    btnAddBottom: document.getElementById('btnAddLinkBottom'),
    copyBtn: document.getElementById('copyPublicLinkBtn'),
    bgColorInput: document.getElementById('bgColorInput'),
    toggleDesignBtn: document.getElementById('toggleDesignOptionsBtn'),
    designContainer: document.getElementById('designOptionsContainer'),
    arrow: document.getElementById('designOptionsArrow'),

    // Modal Elements
    modal: document.getElementById('linkModal'),
    form: document.getElementById('linkForm'),
    modalTitle: document.getElementById('linkModalTitle'),
    closeBtn: document.getElementById('closeLinkModalBtn'),
    cancelBtn: document.getElementById('cancelLinkBtn'),

    // Form Inputs
    inputId: document.getElementById('linkId'),
    inputLabel: document.getElementById('linkLabel'),
    inputUrl: document.getElementById('linkUrl'),
    inputStyle: document.getElementById('linkButtonStyle'),
    inputIsActive: document.getElementById('linkIsActive'),
    styleOptions: document.querySelectorAll('.style-option')
}

// --- Initialization ---

export async function initLinksEditor() {
    try {
        const user = await authService.getCurrentUser()
        if (!user || !user.business_id) return

        currentState.businessId = user.business_id
        await loadData()
        setupEventListeners()

    } catch (error) {
        console.error('Error init links editor:', error)
        notify.error('Error al cargar el editor de enlaces')
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
            button_style_default: page.button_style_default || 'filled',
            slug: page.slug
        }

        // 2. Get Items
        const items = await linksService.getLinkItems(page.id)
        currentState.items = items.sort((a, b) => a.position - b.position)

        // 3. Render
        render()
        updatePreview() // Updates header info

        // Init UI state
        if (UI.bgColorInput) UI.bgColorInput.value = currentState.pageSettings.background_color

    } catch (error) {
        console.error('Error loading data:', error)
        notify.error('Error al cargar datos')
    }
}

function setupEventListeners() {
    // Modal Triggers
    if (UI.btnAdd) UI.btnAdd.addEventListener('click', () => openModal())
    if (UI.btnAddBottom) UI.btnAddBottom.addEventListener('click', () => openModal())

    // Modal Actions
    if (UI.closeBtn) UI.closeBtn.addEventListener('click', closeModal)
    if (UI.cancelBtn) UI.cancelBtn.addEventListener('click', closeModal)
    if (UI.form) UI.form.addEventListener('submit', handleFormSubmit)

    // Style Selection in Modal
    if (UI.styleOptions) {
        UI.styleOptions.forEach(option => {
            option.addEventListener('click', () => {
                UI.styleOptions.forEach(opt => opt.classList.remove('selected'))
                option.classList.add('selected')
                if (UI.inputStyle) UI.inputStyle.value = option.dataset.style
            })
        })
    }

    // Background Color
    if (UI.bgColorInput) {
        UI.bgColorInput.addEventListener('input', (e) => {
            currentState.pageSettings.background_color = e.target.value
            savePageSettings() // Debounced or immediate? Let's do immediate for now or small debounce logic if needed
            updatePreview()
        })
    }

    // Toggle Design Options
    if (UI.toggleDesignBtn) {
        UI.toggleDesignBtn.addEventListener('click', () => {
            const isHidden = UI.designContainer.style.display === 'none'
            UI.designContainer.style.display = isHidden ? 'block' : 'none'
            UI.arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)'
        })
    }

    // Drag and Drop (Simple Sortable Implementation)
    // Note: For a robust drag and drop, a library is better, but we'll stick to basic HTML5 API for now if needed, 
    // or just buttons for moving up/down if simplier.
    // Let's implement basic HTML5 Drag & Drop on the list container

    /* 
       Note: Complex D&D logic omitted for brevity in this specific task unless strictly required. 
       If the user really needs reordering, we can add "Move Up/Down" buttons or basic D&D handlers later.
       For now, we render the list in order.
    */

    if (UI.copyBtn) UI.copyBtn.addEventListener('click', copyPublicLink)
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
        if (UI.btnAddBottom) UI.btnAddBottom.style.display = 'none'
    } else {
        if (UI.btnAddBottom) UI.btnAddBottom.style.display = 'flex'
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

    // Update container background
    const screen = UI.preview.closest('.mockup-screen')
    if (screen) {
        screen.style.backgroundColor = currentState.pageSettings.background_color || '#f8fafc'
    }

    currentState.items.forEach(item => {
        if (!item.is_active) return // Don't show inactive in preview logic? Or show faded? Usually hide.

        const btn = document.createElement('a')
        // const styleClass = getButtonStyleClass(item.button_style || 'filled') 
        // We'll use the CSS classes we added: btn-link--filled, etc.

        let styleType = item.button_style || 'filled'
        // Map old styles if necessary, or assume clean state

        // Define classes based on selection
        let baseClass = 'btn-link'
        let modClass = 'btn-link--filled'
        let shapeClass = 'shape--semi-rounded'

        if (styleType === 'outlined') modClass = 'btn-link--outlined'

        if (styleType === 'rounded') shapeClass = 'shape--rounded'
        if (styleType === 'square') shapeClass = 'shape--square'

        btn.className = `${baseClass} ${modClass} ${shapeClass}`

        // Apply dynamic color if needed (for now using CSS vars or fixed)
        // btn.style.setProperty('--primary-color', '#1e293b') // Could be dynamic from business settings

        btn.href = item.url || '#'
        btn.target = '_blank'
        btn.textContent = item.label

        UI.preview.appendChild(btn)
    })
}

// --- Modal Logic ---

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

    if (!formData.label || !formData.url) {
        notify.error('Por favor completa los campos requeridos')
        return
    }

    const id = UI.inputId ? UI.inputId.value : ''

    // Determine loading state if we had a button loader... 
    // We'll just show toast for now

    try {
        if (id) {
            // Update
            const updated = await linksService.updateLinkItem(id, formData)
            // Update local state
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
        render()

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

async function savePageSettings() {
    // Simple save for settings
    try {
        await linksService.upsertLinkPage(currentState.businessId, currentState.pageSettings)
    } catch (error) {
        console.error('Error saving page settings:', error)
    }
}

// --- Helpers ---

function updatePreview() {
    // Also updates header info like logo and name
    const logoEl = document.getElementById('previewLogo')
    const nameEl = document.getElementById('previewName')

    // We might need to grab this from a global store or DOM if not stored in currentState
    // For now, let's try to assume they are updated elsewhere or grab from Dashboard DOM?
    // Actually, in dashboard.js we usually load business info.
    // Let's just update the background and list for now.

    renderPreview()
}

function copyPublicLink() {
    const slug = currentState.pageSettings?.slug
    if (!slug) return notify.error('Aún no tienes un enlace generado')

    const url = `${window.location.origin}/l/${slug}`
    navigator.clipboard.writeText(url)
        .then(() => notify.success('Enlace copiado al portapapeles'))
        .catch(() => notify.error('Error al copiar enlace'))
}
