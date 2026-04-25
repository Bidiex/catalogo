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
    
    // Calcular no leídas (no vistas o sin acción según requiera el sistema, asumiremos read_at nulo como "no leído" para la campanilla)
    this.unreadCount = this.announcements.filter(a => !a.read_at && !a.dismissed_at).length;
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

    listEl.innerHTML = this.announcements.map(announcement => {
      const isUnread = !announcement.read_at && !announcement.dismissed_at;
      const imgHtml = announcement.image_url
        ? `<img src="${announcement.image_url}" class="notification-img">`
        : '';
      const ctaHtml = announcement.cta_text
        ? `<button class="btn-notification-action" data-id="${announcement.id}">
             ${announcement.cta_text}
           </button>`
        : '';

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${announcement.id}">
          ${imgHtml}
          <div class="notification-info">
            <h4>${announcement.title || 'Notificación'}</h4>
            <p>${announcement.description || ''}</p>
            ${ctaHtml}
          </div>
        </div>
      `;
    }).join('');

    // Listeners para los botones CTA del listado
    listEl.querySelectorAll('.btn-notification-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const found = this.announcements.find(a => a.id === id);
        if (found) {
          this.closePanel();
          // Asumimos que AnnouncementModal se exporta y usa aquí o es expuesto
          if (window.announcementModal) {
            window.announcementModal.show(found);
          } else {
             // Si no está en window, deberíamos importarlo. 
             // Por simplicidad, se dispara un evento.
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
