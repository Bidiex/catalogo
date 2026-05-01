import { supabase } from '../config/supabase.js'

class AnnouncementModal {
  constructor() {
    this.modalEl = null;
    this.currentAnnouncement = null;
    this.init();
  }

  init() {
    // Escuchar el evento para mostrar modal
    window.addEventListener('traego:show-announcement', (e) => {
      this.show(e.detail.announcement);
    });
  }

  createModal() {
    if (this.modalEl) return;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'announcement-modal-overlay';
    this.modalEl.innerHTML = `
      <div class="announcement-modal-content">
        <button class="announcement-modal-close" id="announcementModalCloseBtn">
          <i class="ri-close-line"></i>
        </button>
        <div class="announcement-modal-body">
          <img class="announcement-modal-image" id="announcementModalImage" src="" alt="Announcement">
          <button class="announcement-modal-cta" id="announcementModalCtaBtn"></button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Event Listeners
    this.modalEl.querySelector('#announcementModalCloseBtn').addEventListener('click', async () => {
      if (this.currentAnnouncement) {
        try {
          await supabase.rpc('mark_announcement_dismissed', {
            p_announcement_id: this.currentAnnouncement.announcement_id
          });
        } catch (err) {
          console.error('Error marking announcement dismissed:', err);
        }
      }
      this.hide();
    });

    this.modalEl.querySelector('#announcementModalCtaBtn').addEventListener('click', async () => {
      if (this.currentAnnouncement) {
        try {
          await supabase.rpc('mark_announcement_read', {
            p_announcement_id: this.currentAnnouncement.announcement_id
          });
        } catch (err) {
          console.error('Error marking announcement read:', err);
        }

        const type = this.currentAnnouncement.cta_type;
        const url = this.currentAnnouncement.cta_url;
        const phone = this.currentAnnouncement.cta_phone;
        const wpNumber = this.currentAnnouncement.whatsapp_number;
        const wpMsg = this.currentAnnouncement.whatsapp_message || '';
        
        // Asumimos que window.currentBusiness está disponible, si no, intentamos leer un default
        // En el dashboard.js actual, el currentBusiness es global, pero es mejor leerlo del DOM
        const businessName = document.getElementById('businessBranchName')?.textContent || 'Negocio';

        if (type === 'link' && url) {
          window.open(url, '_blank');
        } else if (type === 'phone' && phone) {
          window.open('tel:' + phone);
        } else if (type === 'whatsapp' && wpNumber) {
          const msg = wpMsg.replace('{nombre_negocio}', businessName);
          window.open('https://wa.me/' + wpNumber + '?text=' + encodeURIComponent(msg), '_blank');
        }
      }
      this.hide();
    });

    // Close on overlay click
    this.modalEl.addEventListener('click', async (e) => {
      if (e.target === this.modalEl) {
        if (this.currentAnnouncement) {
          try {
            await supabase.rpc('mark_announcement_dismissed', {
              p_announcement_id: this.currentAnnouncement.announcement_id
            });
          } catch (err) {
            console.error('Error marking announcement dismissed:', err);
          }
        }
        this.hide();
      }
    });
  }

  async show(announcement) {
    if (!announcement) return;
    this.currentAnnouncement = announcement;
    this.createModal();

    // Actualizar datos
    const imgEl = this.modalEl.querySelector('#announcementModalImage');
    const ctaBtn = this.modalEl.querySelector('#announcementModalCtaBtn');

    imgEl.src = announcement.image_url || '';
    ctaBtn.textContent = announcement.cta_label || 'Ver más';

    // Mostrar modal
    void this.modalEl.offsetWidth; // Repaint
    this.modalEl.classList.add('show');

    // Marcar como visto
    try {
      await supabase.rpc('mark_announcement_seen', {
        p_announcement_id: this.currentAnnouncement.announcement_id
      });
    } catch (err) {
      console.error('Error marking announcement seen:', err);
    }
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.classList.remove('show');
      this.currentAnnouncement = null;
    }
  }
}

export const announcementModal = new AnnouncementModal();
