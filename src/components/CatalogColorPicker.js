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
      <div class="color-picker-component">
        <div class="picker-controls">
          <div class="color-input-group">
            <label>Color de fondo</label>
            <div class="input-wrapper">
              <input type="color" id="catalogBgColorInput" value="${this.currentColor}">
              <input type="text" id="catalogBgHexInput" value="${this.currentColor}" maxlength="7">
            </div>
          </div>
          
          <div class="swatches-group">
            <label>Sugerencias</label>
            <div class="swatches-grid" id="colorSwatches">
              ${this.getSwatchesHtml()}
            </div>
          </div>

          <div id="contrastWarning" class="contrast-warning hidden">
            <i class="ri-error-warning-line"></i>
            <span>El contraste podría ser insuficiente para algunos usuarios (bajo 4.5:1).</span>
          </div>

          <button id="saveCatalogColorBtn" class="btn-save-color">
            <i class="ri-save-line"></i> Guardar Cambios
          </button>
        </div>

        <div class="picker-preview">
          <label>Vista previa del catálogo</label>
          <div id="catalogPreviewFrame" class="preview-frame">
            <div class="preview-header">
              <div class="preview-business-name">Mi Negocio</div>
              <div class="preview-category-pills">
                <div class="preview-pill active">Categoría</div>
                <div class="preview-pill">Otra</div>
              </div>
            </div>
            <div class="preview-card">
              <div class="preview-card-img"></div>
              <div class="preview-card-body">
                <div class="preview-card-title">Hamburguesa Clásica</div>
                <div class="preview-card-desc">Con queso y papas fritas...</div>
                <div class="preview-card-footer">
                  <div class="preview-card-price">$12.500</div>
                  <div class="preview-card-btn"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.updatePreview(this.currentColor);
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
    this.updatePreview(hex);
    this.checkContrast(hex);
  }

  updatePreview(hex) {
    const theme = buildCatalogTheme(hex);
    const frame = this.container.querySelector('#catalogPreviewFrame');
    
    // Apply theme variables to the preview frame
    Object.entries(theme).forEach(([key, value]) => {
      frame.style.setProperty(key, value);
    });
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
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  }
}
