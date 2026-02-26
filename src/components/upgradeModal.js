/**
 * Upgrade Modal Component
 * Displays a generic "Pro Feature" blockage modal when clicking on locked elements.
 */

class UpgradeModal {
    constructor() {
        this.modalEl = null;
        this.init();
    }

    init() {
        // Listen to the custom event dispatched by featureLocker
        window.addEventListener('traego:upgrade-required', (e) => {
            this.show(e.detail.featureName);
        });
    }

    createModal() {
        if (this.modalEl) return;

        this.modalEl = document.createElement('div');
        this.modalEl.className = 'upgrade-modal';
        this.modalEl.innerHTML = `
      <div class="upgrade-modal-content">
        <div class="upgrade-modal-header">
          <button class="upgrade-modal-close" id="upgradeModalCloseBtn"><i class="ri-close-line"></i></button>
          <div class="upgrade-modal-icon">
            <i class="ri-vip-crown-line"></i>
          </div>
          <h2 class="upgrade-modal-title">Funcionalidad Pro</h2>
        </div>
        <div class="upgrade-modal-body">
          <p class="upgrade-modal-desc" id="upgradeModalDesc">
            Esta funcionalidad es exclusiva del plan Traego Pro.
            Mejora tu plan para desbloquear su potencial.
          </p>
          <div class="upgrade-modal-actions">
            <a href="https://wa.me/573000000000?text=Hola,%20quiero%20mejorar%20mi%20plan%20a%20Pro" target="_blank" class="btn-upgrade-action">
              <i class="ri-rocket-line"></i> Mejorar a Pro
            </a>
            <button class="btn-upgrade-cancel" id="upgradeModalCancelBtn">Quizás más tarde</button>
          </div>
        </div>
      </div>
    `;

        document.body.appendChild(this.modalEl);

        // Event listeners
        this.modalEl.querySelector('#upgradeModalCloseBtn').addEventListener('click', () => this.hide());
        this.modalEl.querySelector('#upgradeModalCancelBtn').addEventListener('click', () => this.hide());

        // Close on overlay click
        this.modalEl.addEventListener('click', (e) => {
            if (e.target === this.modalEl) {
                this.hide();
            }
        });
    }

    show(featureName) {
        this.createModal();

        // Optional: Customize text depending on featureName
        const descEl = this.modalEl.querySelector('#upgradeModalDesc');
        let featureText = 'Esta funcionalidad es exclusiva';

        // Map feature IDs to readable text
        const featureLabels = {
            'order-tracking': 'El seguimiento de pedidos en línea',
            'order-suggestions': 'Las sugerencias inteligentes en el checkout'
        };

        if (featureName && featureLabels[featureName]) {
            featureText = featureLabels[featureName] + ' es exclusiva';
        }

        descEl.textContent = `${featureText} del plan Traego Pro. Mejora tu plan para desbloquear su potencial.`;

        // Force layout repaint before adding class to trigger animation
        void this.modalEl.offsetWidth;
        this.modalEl.classList.add('show');
    }

    hide() {
        if (this.modalEl) {
            this.modalEl.classList.remove('show');
        }
    }
}

export const upgradeModal = new UpgradeModal();
