import { supabase } from '../../../config/supabase.js'
import { authService } from '../../../services/auth.js'
import { authGuard } from '../../../utils/auth-guard.js'
import { notify } from '../../../utils/notifications.js'
import { confirm } from '../../../utils/notifications.js'
import { imageService } from '../../../services/images.js'

let state = {
    items: [],
    filtered: [],
    filter: {
        status: 'all',
        search: ''
    }
}

// Elements
const container = document.getElementById('announcementsContainer')
const searchInput = document.getElementById('searchInput')
const filterChips = document.querySelectorAll('.filter-chip')
const totalResults = document.getElementById('totalResults')

const btnNewAnn = document.getElementById('btnNewAnn')
const announcementModal = document.getElementById('announcementModal')
const btnCloseModal = document.getElementById('btnCloseModal')
const btnCancelAnn = document.getElementById('btnCancelAnn')
const form = document.getElementById('announcementForm')

const ctaTypeSelect = document.getElementById('annCtaType')
const imageFileInput = document.getElementById('annImageFile')
const imagePreviewContainer = document.getElementById('annImagePreviewContainer')
const imagePreview = document.getElementById('annImagePreview')
const imageUrlHidden = document.getElementById('annImageUrl')

init()

async function init() {
    try {
        const { isAdmin } = await authGuard.checkAdminSession()
        if (!isAdmin) {
            window.location.href = '/login'
            return
        }

        const user = await authService.getCurrentUser()
        if (user) {
            document.getElementById('adminEmail').textContent = user.email
        }

        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await authService.signOut()
            authGuard.clearAdminCache()
            window.location.href = '/login'
        })

        setupEventListeners()
        await loadAnnouncements()
    } catch (error) {
        console.error('Error inicializando admin de anuncios:', error)
    }
}

function setupEventListeners() {
    // Modal controls
    btnNewAnn.addEventListener('click', () => openModal())
    btnCloseModal.addEventListener('click', closeModal)
    btnCancelAnn.addEventListener('click', closeModal)

    // Form logic
    ctaTypeSelect.addEventListener('change', (e) => {
        const val = e.target.value
        document.getElementById('groupUrl').style.display = val === 'link' ? 'block' : 'none'
        document.getElementById('groupPhone').style.display = (val === 'phone' || val === 'whatsapp') ? 'block' : 'none'
        document.getElementById('groupWhatsapp').style.display = val === 'whatsapp' ? 'block' : 'none'
        document.getElementById('groupWhatsappMsg').style.display = val === 'whatsapp' ? 'block' : 'none'
    })

    imageFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]
        if (!file) {
            imagePreviewContainer.style.display = 'none'
            imageUrlHidden.value = ''
            return
        }

        const reader = new FileReader()
        reader.onload = (ev) => {
            imagePreview.src = ev.target.result
            imagePreviewContainer.style.display = 'flex'
        }
        reader.readAsDataURL(file)
    })

    form.addEventListener('submit', async (e) => {
        e.preventDefault()
        await saveAnnouncement()
    })

    // Filters
    searchInput.addEventListener('input', (e) => {
        state.filter.search = e.target.value.toLowerCase()
        applyFilters()
    })

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'))
            chip.classList.add('active')
            state.filter.status = chip.dataset.filter
            applyFilters()
        })
    })
}

async function loadAnnouncements() {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        
        state.items = data || []
        applyFilters()
    } catch (err) {
        console.error(err)
        container.innerHTML = '<p style="grid-column: 1/-1;">Error cargando anuncios.</p>'
    }
}

function applyFilters() {
    state.filtered = state.items.filter(item => {
        // Status filter
        if (state.filter.status === 'active' && !item.is_active) return false
        if (state.filter.status === 'inactive' && item.is_active) return false

        // Search filter
        if (state.filter.search && !item.title.toLowerCase().includes(state.filter.search)) return false

        return true
    })

    updateCounts()
    renderCards()
}

function updateCounts() {
    const counts = {
        all: state.items.length,
        active: state.items.filter(i => i.is_active).length,
        inactive: state.items.filter(i => !i.is_active).length
    }

    document.getElementById('count-all').textContent = counts.all
    document.getElementById('count-active').textContent = counts.active
    document.getElementById('count-inactive').textContent = counts.inactive

    totalResults.textContent = `${state.filtered.length} anuncio${state.filtered.length !== 1 ? 's' : ''} encontrado${state.filtered.length !== 1 ? 's' : ''}`
}

function renderCards() {
    if (state.filtered.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 0.5rem; border: 1px dashed var(--border-color); color: var(--text-secondary);">No se encontraron anuncios.</div>'
        return
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'Sin caducidad'
        const d = new Date(dateString)
        return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
    }

    const planLabels = {
        'all': 'Todos',
        'free': 'Free',
        'plus': 'Plus',
        'pro': 'Pro'
    }

    container.innerHTML = state.filtered.map(ann => `
        <div class="ann-card ${ann.is_active ? '' : 'inactive'}">
            <div style="position: relative;">
                ${ann.image_url 
                    ? `<img src="${ann.image_url}" class="ann-card-image" alt="${ann.title}">`
                    : `<div class="ann-card-image-placeholder"><i class="fa-solid fa-image"></i></div>`
                }
                <div class="ann-card-badges">
                    <span class="ann-badge-type ${ann.type || 'none'}">${ann.type || 'Sin tipo'}</span>
                    ${ann.show_as_modal ? '<span class="ann-badge-modal">MODAL</span>' : '<span class="ann-badge-modal" style="background: rgba(255,255,255,0.8); color: var(--text-primary);">CAMPANILLA</span>'}
                </div>
            </div>
            
            <div class="ann-card-content">
                <h4 class="ann-card-title">${ann.title}</h4>
                <div class="ann-card-meta">
                    <span><i class="fa-solid fa-bullseye"></i> Plan: ${planLabels[ann.target_plan] || 'Todos'}</span>
                    <span><i class="fa-regular fa-calendar-xmark"></i> Expira: ${formatDate(ann.expires_at)}</span>
                    <span style="margin-top: 0.25rem;">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${ann.is_active ? '#10b981' : '#ef4444'};"></span>
                        ${ann.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                
                <div class="ann-card-actions">
                    <div class="toggle-switch">
                        <label class="switch">
                            <input type="checkbox" ${ann.is_active ? 'checked' : ''} onchange="window.toggleAnnStatus('${ann.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-secondary" style="padding: 0.4rem 0.6rem;" onclick="window.editAnn('${ann.id}')" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-secondary" style="padding: 0.4rem 0.6rem; color: #dc2626; border-color: #fca5a5; background-color: #fef2f2;" onclick="window.deleteAnn('${ann.id}')" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('')
}

function openModal(ann = null) {
    form.reset()
    document.getElementById('modalLimitWarning').style.display = 'none'
    
    if (ann) {
        document.getElementById('modalTitle').textContent = 'Editar Anuncio'
        document.getElementById('annId').value = ann.id
        document.getElementById('annTitle').value = ann.title
        document.getElementById('annDesc').value = ann.body || ''
        document.getElementById('annType').value = ann.type || 'promo'
        document.getElementById('annTargetPlan').value = ann.target_plan || 'all'
        
        if (ann.expires_at) {
            // Convert to YYYY-MM-DD for date input
            document.getElementById('annExpiresAt').value = ann.expires_at.split('T')[0]
        }
        
        document.getElementById('annShowModal').checked = ann.show_as_modal
        document.getElementById('annIsActive').checked = ann.is_active
        
        document.getElementById('annCtaType').value = ann.cta_type || 'none'
        document.getElementById('annCtaText').value = ann.cta_label || ''
        document.getElementById('annUrl').value = ann.cta_url || ''
        document.getElementById('annPhone').value = ann.cta_phone || ''
        document.getElementById('annWhatsapp').value = ann.whatsapp_number || ''
        document.getElementById('annWhatsappMsg').value = ann.whatsapp_message || ''

        if (ann.image_url) {
            imageUrlHidden.value = ann.image_url
            imagePreview.src = ann.image_url
            imagePreviewContainer.style.display = 'flex'
        } else {
            imageUrlHidden.value = ''
            imagePreviewContainer.style.display = 'none'
        }
    } else {
        document.getElementById('modalTitle').textContent = 'Nuevo Anuncio'
        document.getElementById('annId').value = ''
        document.getElementById('annIsActive').checked = true
        document.getElementById('annShowModal').checked = false
        document.getElementById('annCtaType').value = 'none'
        imageUrlHidden.value = ''
        imagePreviewContainer.style.display = 'none'
    }

    ctaTypeSelect.dispatchEvent(new Event('change'))
    announcementModal.style.display = 'flex'
}

function closeModal() {
    announcementModal.style.display = 'none'
    form.reset()
}

async function saveAnnouncement() {
    const btn = document.getElementById('btnSubmitAnn')
    const ogText = btn.textContent
    btn.textContent = 'Guardando...'
    btn.disabled = true
    document.getElementById('modalLimitWarning').style.display = 'none'

    try {
        let finalImageUrl = imageUrlHidden.value
        const file = imageFileInput.files[0]

        if (file) {
            btn.textContent = 'Subiendo imagen...'
            const result = await imageService.upload(file, 'announcements')
            if (result.success) {
                finalImageUrl = result.url
                imageUrlHidden.value = finalImageUrl
            } else {
                throw new Error('Error al subir la imagen')
            }
        }

        const id = document.getElementById('annId').value
        const showAsModal = document.getElementById('annShowModal').checked
        const isActive = document.getElementById('annIsActive').checked

        // Validate modal limit purely frontend (prevent unnecessary request if we know it fails)
        if (showAsModal && isActive) {
            const activeModalsCount = state.items.filter(i => i.show_as_modal && i.is_active && i.id !== id).length
            if (activeModalsCount >= 3) {
                document.getElementById('modalLimitWarning').style.display = 'block'
                return // Stay in modal
            }
        }

        btn.textContent = 'Guardando BD...'

        const dataToSave = {
            title: document.getElementById('annTitle').value,
            body: document.getElementById('annDesc').value || null,
            type: document.getElementById('annType').value,
            target_plan: document.getElementById('annTargetPlan').value,
            expires_at: document.getElementById('annExpiresAt').value ? new Date(document.getElementById('annExpiresAt').value).toISOString() : null,
            image_url: finalImageUrl || null,
            cta_type: ctaTypeSelect.value,
            cta_label: document.getElementById('annCtaText').value || null,
            cta_url: document.getElementById('annUrl').value || null,
            cta_phone: document.getElementById('annPhone').value || null,
            whatsapp_number: document.getElementById('annWhatsapp').value || null,
            whatsapp_message: document.getElementById('annWhatsappMsg').value || null,
            show_as_modal: showAsModal,
            is_active: isActive
        }

        console.log('Enviando a Supabase este payload:', dataToSave);

        let error;
        if (id) {
            const res = await supabase.from('announcements').update(dataToSave).eq('id', id)
            error = res.error
        } else {
            const res = await supabase.from('announcements').insert([dataToSave])
            error = res.error
        }

        if (error) {
            console.error('ERROR SUPABASE - message:', error.message);
            console.error('ERROR SUPABASE - details:', error.details);
            console.error('ERROR SUPABASE - hint:', error.hint);
            console.error('ERROR SUPABASE - code:', error.code);
            console.error('ERROR SUPABASE - payload enviado:', dataToSave);
            if (error.message && error.message.includes('MODAL_LIMIT_EXCEEDED')) {
                document.getElementById('modalLimitWarning').style.display = 'block'
                return // Stay in modal
            }
            throw error
        }

        notify.success(id ? 'Anuncio actualizado' : 'Anuncio creado')
        closeModal()
        await loadAnnouncements()
    } catch (err) {
        console.error(err)
        const errorMsg = err?.message || 'Error desconocido'
        notify.error(`Error al guardar: ${errorMsg}`)
    } finally {
        btn.textContent = ogText
        btn.disabled = false
    }
}

// Global functions for inline HTML event handlers
window.toggleAnnStatus = async (id, newStatus) => {
    try {
        const item = state.items.find(i => i.id === id)
        
        if (newStatus && item && item.show_as_modal) {
            const activeModalsCount = state.items.filter(i => i.show_as_modal && i.is_active && i.id !== id).length
            if (activeModalsCount >= 3) {
                notify.error('Ya tienes 3 anuncios activos con modal. Desactiva uno primero.', 5000)
                renderCards() // Reset toggle
                return
            }
        }

        const { error } = await supabase
            .from('announcements')
            .update({ is_active: newStatus })
            .eq('id', id)

        if (error) {
            if (error.message && error.message.includes('MODAL_LIMIT_EXCEEDED')) {
                notify.error('Ya tienes 3 anuncios activos con modal.', 5000)
                renderCards()
                return
            }
            throw error
        }
        notify.success(newStatus ? 'Anuncio activado' : 'Anuncio desactivado')
        await loadAnnouncements()
    } catch (err) {
        console.error(err)
        notify.error('Error al cambiar estado')
        renderCards() // Reset toggle UI
    }
}

window.editAnn = (id) => {
    const ann = state.items.find(i => i.id === id)
    if (ann) openModal(ann)
}

window.deleteAnn = async (id) => {
    const res = await confirm.show({
        title: 'Eliminar Anuncio',
        message: '¿Estás seguro de eliminar este anuncio permanentemente?',
        confirmText: 'Sí, eliminar',
        type: 'danger'
    })

    if (res) {
        try {
            const { error } = await supabase.from('announcements').delete().eq('id', id)
            if (error) throw error
            notify.success('Anuncio eliminado')
            await loadAnnouncements()
        } catch (err) {
            console.error(err)
            notify.error('Error al eliminar')
        }
    }
}
