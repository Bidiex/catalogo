import { buildCatalogTheme, getRelativeLuminance } from '../utils/catalogTheme.js'

export class CatalogColorPicker {
  /**
   * @param {Object} options - { initialColor, onSave }
   */
  constructor({ initialColor = '#FFFFFF', onSave } = {}) {
    this.currentColor = initialColor;
    this.onSave = onSave;
  }

  render(container) {
    if (typeof container === 'string') {
      this.container = document.getElementById(container);
    } else {
      this.container = container;
    }

    if (!this.container) return;

    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Color de Fondo del Catálogo</h2>
        </div>
        <div class="card-body">
          <p class="color-picker-description">Selecciona el color que tendrá tu catálogo público.</p>
          
          <div class="color-picker-component">
            <div class="form-group">
              <label for="catalogBgColorInput">Color de fondo</label>
              <div class="color-inputs-row">
                <div id="selectedColorIndicator" class="selected-color-indicator" style="background-color: ${this.currentColor}"></div>
                <input type="color" id="catalogBgColorInput" value="${this.currentColor}">
                <input type="text" id="catalogBgHexInput" value="${this.currentColor}" placeholder="#FFFFFF" maxlength="7">
              </div>
            </div>

            <label class="picker-label">Sugerencias</label>
            <div id="colorSwatches" class="color-swatches">
              ${this.getSwatchesHtml()}
            </div>

            <div id="contrastWarning" class="contrast-warning">
              <i class="ri-error-warning-line"></i>
              <span>Este color podría dificultar la lectura del texto.</span>
            </div>

            <div class="form-actions">
              <button id="saveCatalogColorBtn" class="btn btn-primary">
                <i class="ri-save-line"></i> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.checkContrast(this.currentColor);
  }

  getSwatchesHtml() {
    const presets = [
      '#FFFFFF', '#111111', '#1A1A2E', '#0F2027', 
      '#2D1B00', '#F5F0E8', '#FFF8F0', '#F0F4F8'
    ];
    return presets.map(color => `
      <div class="swatch ${color === this.currentColor ? 'active' : ''}" 
           style="background-color: ${color}" 
           data-color="${color}"></div>
    `).join('');
  }

  setupEventListeners() {
    const colorInput = this.container.querySelector('#catalogBgColorInput');
    const hexInput = this.container.querySelector('#catalogBgHexInput');
    const swatches = this.container.querySelectorAll('.swatch');
    const saveBtn = this.container.querySelector('#saveCatalogColorBtn');

    colorInput.addEventListener('input', (e) => {
      this.updateColor(e.target.value);
      hexInput.value = e.target.value;
    });

    hexInput.addEventListener('input', (e) => {
      let val = e.target.value;
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        this.updateColor(val);
        colorInput.value = val;
      }
    });

    const indicator = this.container.querySelector('#selectedColorIndicator');
    indicator.addEventListener('click', () => colorInput.click());

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.dataset.color;
        this.updateColor(color);
        colorInput.value = color;
        hexInput.value = color;
        
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });
    });

    saveBtn.addEventListener('click', async () => {
      if (this.onSave) {
        try {
          await this.onSave(this.currentColor);
        } catch (error) {
          console.error('Save failed:', error);
        }
      }
    });
  }

  updateColor(hex) {
    this.currentColor = hex;
    const indicator = this.container.querySelector('#selectedColorIndicator');
    if (indicator) {
      indicator.style.backgroundColor = hex;
    }
    this.checkContrast(hex);
  }

  checkContrast(hex) {
    const luminance = getRelativeLuminance(hex);
    const warning = this.container.querySelector('#contrastWarning');
    
    // WCAG AA is 4.5:1. 
    // Simplified check: if background is too close to middle gray, warning.
    // Real check: contrast with white or black depending on isDark.
    const isDark = luminance < 0.35;
    const textColor = isDark ? '#FFFFFF' : '#111111';
    const textLum = getRelativeLuminance(textColor);
    
    const L1 = Math.max(luminance, textLum);
    const L2 = Math.min(luminance, textLum);
    const ratio = (L1 + 0.05) / (L2 + 0.05);

    if (ratio < 4.5) {
      warning.classList.add('visible');
    } else {
      warning.classList.remove('visible');
    }
  }
}
