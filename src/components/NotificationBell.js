import { supabase } from '../config/supabase.js'

class NotificationBell {
  constructor() {
    this.bellBtn = null;
    this.panelOverlay = null;
    this.panelEl = null;
    this.announcements = [];
    this.unreadCount = 0;
    this.init();
  }

  init() {
    window.addEventListener('traego:announcements-loaded', (e) => {
      this.setAnnouncements(e.detail.announcements);
    });
  }

  createElements() {
    if (this.bellBtn) return;

    // Buscar el botón estático existente
    this.bellBtn = document.getElementById('headerNotificationBtn');
    if (!this.bellBtn) return;

    // Buscar o crear los paneles
    this.panelOverlay = document.getElementById('notificationsOverlay');
    this.panelEl = document.getElementById('notificationsPanel');

    // Si no existen, los inyectamos (para evitar depender estrictamente del HTML estático si falta)
    if (!this.panelOverlay || !this.panelEl) {
      const container = document.querySelector('.dashboard-container') || document.body;
      
      if (!this.panelOverlay) {
        this.panelOverlay = document.createElement('div');
        this.panelOverlay.id = 'notificationsOverlay';
        this.panelOverlay.className = 'notifications-panel-overlay';
        container.appendChild(this.panelOverlay);
      }
      
      if (!this.panelEl) {
        this.panelEl = document.createElement('aside');
        this.panelEl.id = 'notificationsPanel';
        this.panelEl.className = 'notifications-panel';
        this.panelEl.innerHTML = `
          <div class="notifications-panel-header">
            <h2>Notificaciones</h2>
            <button id="closeNotificationsBtn" class="close-panel-btn">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <div class="notifications-panel-content" id="notificationsList">
            <!-- Anuncios inyectados por JS -->
          </div>
        `;
        container.appendChild(this.panelEl);
      }
    }

    // Event Listeners
    this.bellBtn.addEventListener('click', () => this.togglePanel());
    
    const closeBtn = document.getElementById('closeNotificationsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    this.panelOverlay.addEventListener('click', () => this.closePanel());
  }

  setAnnouncements(announcements) {
    this.createElements();
    this.announcements = announcements || [];
    
    // Calcular no leídas para el badge (solo vistas nulas)
    this.unreadCount = this.announcements.filter(a => !a.seen_at).length;
    this.updateBadge();
    this.renderList();
  }

  updateBadge() {
    if (!this.bellBtn) return;
    const badge = this.bellBtn.querySelector('.notification-badge');
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  renderList() {
    if (!this.panelEl) return;
    const listEl = this.panelEl.querySelector('#notificationsList');
    if (!listEl) return;

    if (this.announcements.length === 0) {
      listEl.innerHTML = `
        <div class="notifications-empty">
          <i class="ri-notification-off-line"></i>
          <p>No tienes notificaciones por ahora</p>
        </div>
      `;
      return;
    }

    const unreadAnns = this.announcements.filter(a => !a.read_at);
    const readAnns = this.announcements.filter(a => a.read_at);

    let html = '';

    const renderCard = (announcement) => {
      const isUnread = !announcement.read_at;
      const imgHtml = announcement.image_url
        ? `<div class="notification-img-wrapper"><img src="${announcement.image_url}" class="notification-img"></div>`
        : '';
        
      const typeClass = announcement.type ? `badge-${announcement.type.toLowerCase()}` : 'badge-default';
      const typeLabel = announcement.type ? announcement.type : 'Aviso';
      
      const dateFormatted = announcement.created_at ? new Date(announcement.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

      return `
        <div class="notification-item ${isUnread ? 'unread' : 'read'}" data-id="${announcement.announcement_id}">
          ${imgHtml}
          <div class="notification-info">
            <div class="notification-meta">
              <span class="notification-badge-type ${typeClass}">${typeLabel}</span>
              <span class="notification-date">${dateFormatted}</span>
            </div>
            <h4>${announcement.title || 'Notificación'}</h4>
            <p>${announcement.description || ''}</p>
          </div>
        </div>
      `;
    };

    if (unreadAnns.length > 0) {
      html += `<h3 class="notifications-section-title">Sin leer</h3>`;
      html += unreadAnns.map(renderCard).join('');
    }

    if (readAnns.length > 0) {
      if (unreadAnns.length > 0) {
        html += `<div class="notifications-separator"></div>`;
      }
      html += `<h3 class="notifications-section-title">Leídas</h3>`;
      html += readAnns.map(renderCard).join('');
    }

    listEl.innerHTML = html;

    // Listeners para las cards del listado
    listEl.querySelectorAll('.notification-item').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const found = this.announcements.find(a => String(a.announcement_id) === String(id));
        if (found) {
          this.closePanel();
          
          if (!found.read_at) {
            try {
              // Llamar a Supabase para marcar como leído
              await supabase.rpc('mark_announcement_read', { p_announcement_id: found.announcement_id });
              
              // Actualizar el estado local
              found.read_at = new Date().toISOString();
              
              // Actualizar el conteo de no vistos si aplica
              if (!found.seen_at) {
                found.seen_at = new Date().toISOString();
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
              }
              
              // Modificar DOM directamente para una respuesta más suave
              card.classList.remove('unread');
              card.classList.add('read');
              
              // Actualizamos la lista completa después de un momento para que se reordene si abren de nuevo
              setTimeout(() => this.renderList(), 500);
            } catch (err) {
              console.error('Error marking announcement as read:', err);
            }
          }

          // Mostrar Modal
          if (window.announcementModal) {
            window.announcementModal.show(found);
          } else {
             window.dispatchEvent(new CustomEvent('traego:show-announcement', { detail: { announcement: found }}));
          }
        }
      });
    });
  }

  togglePanel() {
    if (!this.panelEl) return;
    const isOpen = this.panelEl.classList.contains('open');
    if (isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    if (this.panelEl && this.panelOverlay) {
      this.panelEl.classList.add('open');
      this.panelOverlay.classList.add('active');
    }
  }

  closePanel() {
    if (this.panelEl && this.panelOverlay) {
      this.panelEl.classList.remove('open');
      this.panelOverlay.classList.remove('active');
    }
  }
}

export const notificationBell = new NotificationBell();
